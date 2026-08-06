# Regen Sydney — crowdfunding and voting

A standalone Next.js app (port 3002) where supporters contribute in AUD, receive RSUT, and use
it to vote on which Regen Sydney projects the pooled funds go to.

It lives in this monorepo to share Hypha's database and Privy app, but it renders its own
`<html>` — none of Hypha's chrome, navigation or theming leaks in.

## How it works

**One token, two ways to get it.** RSUT (Regen Sydney Utility Token) is an existing decaying
ERC-20 on Base at `0xaacf3eb65badeebf3206c5d241b851c7c8fc2ac1`, owned by the RS Core Team space.
Signing in for the first time grants a joining bonus; contributing grants 1 RSUT per A$1. Both
paths write a row to `campaign_grants` and mint to the member's Privy embedded wallet.

**Voting is off-chain.** No new contracts. A member spreads their RSUT balance across projects
in `campaign_votes`; the tally is pro-rata over the round's pot. This keeps voting free and
instant, and means a change of mind costs nothing.

**Rounds.** One `campaign_cycles` row is open at a time — enforced by a partial unique index, so
the database itself refuses a second open round. Closing a round freezes the tally into
`campaign_payouts`, which is the worksheet an admin works through when transferring funds.
Voting power carries over between rounds; individual votes do not.

**Funds are moved by hand.** Contributions land in the campaign's payment account. The admin
Distribution tab shows what each project earned and tracks which transfers have been made. There
is no automated payout.

## Running it

```bash
pnpm install                                  # copies .env.template to .env
pnpm --filter regen-sydney seed               # projects + opening round
pnpm --filter regen-sydney dev                # http://localhost:3002
```

`DEFAULT_DB_URL` and `PRIVY_APP_SECRET` are the only two variables you need for a useful local
run. Everything else has a working default — see `.env.template`, which documents each one.

### Local database

The app talks to Postgres through Neon's serverless driver, so locally it needs Neon's websocket
proxy in front of a plain Postgres. `packages/storage-postgres/src/db.ts` switches to the proxy
automatically when the connection string points at localhost.

```bash
docker run -d --name rs-pg -e POSTGRES_PASSWORD=postgres -p 55499:5432 postgres:16
docker run -d --name rs-neon-proxy --link rs-pg -p 5433:4444 \
  -e PG_CONNECTION_STRING=postgres://postgres:postgres@rs-pg:5432/regen \
  ghcr.io/timowilhelm/local-neon-http-proxy:main
```

Then `DEFAULT_DB_URL=postgres://postgres:postgres@localhost:5432/regen`. The port in that URL is
ignored — the driver routes through the proxy on 5433 — but the host must say `localhost` for the
switch to trigger.

Migrations live with the rest of the platform's:

```bash
pnpm --filter @hypha-platform/storage-postgres run migrate
```

### Tests

```bash
DEFAULT_DB_URL=postgres://postgres:postgres@localhost:5432/regen \
  pnpm --filter regen-sydney test
```

The campaign tests run against that same Postgres rather than mocks, because the behaviour worth
checking — grant idempotency, the one-open-round constraint, atomic ballot replacement — is
enforced by the database. Each run parks the development data, creates its own people, projects
and round, and puts everything back afterwards, so running it against a seeded database is safe.

Without a connection string those are skipped and only the suites that need nothing run — the
Stripe webhook checks, which cover signature verification, replay windows and the unpaid-session
case.

## Checkout

Stripe is the provider. It is reached through the adapter in
`src/server/payments/provider.ts` — create a session, verify a webhook, return a normalised
`PaymentEvent` — so the grant ledger, idempotency and minting never mention Stripe by name.
`CAMPAIGN_PAYMENTS_PROVIDER` still selects between:

| Value | Behaviour |
| --- | --- |
| `stripe` | Stripe Checkout. Not Merchant of Record, so Regen Sydney stays the seller — which keeps DGR receipting straightforward. |
| `mock` | Redirects to `/checkout/mock`, which posts a self-signed webhook back. Exercises the real grant and mint path with no Stripe account. |
| `paddle` | Kept working but unused. Merchant of Record, which complicates DGR receipting. |

### Connecting the Stripe sandbox

1. In the Stripe dashboard, switch to a **sandbox** (or test mode) and copy the secret key from
   Developers → API keys. It starts `sk_test_`.
2. Get a webhook secret. Locally that means the Stripe CLI:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3002/api/webhooks/payments
   ```

   It prints a `whsec_…` for this session. Deployed, add an endpoint at
   `https://<host>/api/webhooks/payments` for `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` and `charge.refunded`, and copy its signing secret.

3. Put both in `.env` alongside `CAMPAIGN_PAYMENTS_PROVIDER=stripe`.
4. Check the wiring, with the dev server running:

   ```bash
   pnpm --filter regen-sydney stripe:check
   ```

   It refuses a live key, opens a throwaway A$25 session against the real Stripe API, replays a
   correctly signed webhook at the local app, and confirms a tampered one is rejected.

5. Contribute through the UI and pay with `4242 4242 4242 4242`, any future expiry and any CVC.
   The grant appears under Admin → Contributions.

The admin Status tab reports whether the key in use is `test` or `live`, so a real charge is never
a surprise.

Two details worth knowing. `checkout.session.completed` fires when the customer finishes the form,
which for delayed methods is before the money moves — so an unpaid session is ignored and the
grant waits for `checkout.session.async_payment_succeeded`. And the idempotency key is
`stripe:<checkout session id>`, so however often Stripe retries, one checkout yields one grant and
at most one mint.

## Relayer

Minting needs a hot wallet that RSUT recognises, because `mint` is gated on
`msg.sender == executor || isAuthorizedMinter[msg.sender]`. Create one with:

```bash
pnpm --filter regen-sydney exec node scripts/new-relayer.mjs
```

It writes the key to the gitignored `.env` and prints only the address. **Fund that address with a
little ETH on Base** — it pays gas for every mint — and copy the key into Vercel as
`RSUT_RELAYER_PRIVATE_KEY` for the deployed app.

Then authorise it, from the token owner (`0x2687fe290b54d824c136Ceff2d5bD362Bc62019a`, whose key is
`PRIVATE_KEY` in `packages/storage-evm/.env`):

```bash
cd packages/storage-evm
node scripts/rsut-upgrade.mjs --relayer 0x…             # dry run, signs nothing
node scripts/rsut-upgrade.mjs --relayer 0x… --execute
```

The dry run simulates against live state: that the target implementation carries the functions we
need, that name, symbol, supply, space id, owner and executor survive the upgrade, that decay
stays off, and that an authorised minter can mint.

Two things worth knowing about the ownership model. The owner **cannot** mint directly, even after
the upgrade — `mint` recognises only the executor and authorised minters, so the owner's power is
to appoint minters (itself included), not to mint. And RSUT's proxy was originally deployed from a
build predating `isAuthorizedMinter`, which is why the upgrade is needed at all; it now runs
`0x02603dEf…08D9`, the same implementation the token factory deploys for every new space token.

If the relayer is not set up, leave `RSUT_RELAYER_PRIVATE_KEY` blank. Grants are still recorded and
votes still count — voting power reads the ledger, not the chain — and the mints sit at `pending`.
The admin Status tab shows the relayer's address, balance and authorisation, and can retry the
backlog once the authorisation lands.

## Admin

`CAMPAIGN_ADMIN_EMAILS` is a comma-separated allowlist, checked server-side on every admin
endpoint. The email it is checked against comes from Privy's own record of the user, fetched with
the app secret — never from the request body, which the caller controls. The `/admin` page hiding
itself is a convenience, not the control.

Tabs: Projects (add, edit, hide, remove), Cycle (duration, match multiplier, close and open the
next), Contributions (the grant ledger), Distribution (payout worksheet, mark transfers made),
Status (relayer and provider diagnostics).

## Layout

```
src/
  app/
    _components/     UI, all client
    _lib/            Privy provider, API client, campaign store
    api/             route handlers
    admin/           admin console
    checkout/mock/   mock provider's hosted-page stand-in
  server/
    campaign/        projects, cycles, voting, grants, contributions, seed
    payments/        provider interface + mock, paddle, stripe
    chain/           RSUT ABI and relayer mint
    auth.ts          Privy verification, person upsert, admin gate
    config.ts        env reading and validation
```

Schema lives in `packages/storage-postgres/src/schema/campaign.ts` so Hypha and the campaign
share one `people` table and one migration history.
