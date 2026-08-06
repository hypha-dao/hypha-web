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

They run against that same Postgres rather than mocks, because the behaviour worth checking —
grant idempotency, the one-open-round constraint, atomic ballot replacement — is enforced by the
database. Each run parks the development data, creates its own people, projects and round, and
puts everything back afterwards, so running it against a seeded database is safe.

## Checkout is deliberately unresolved

The choice between Paddle and Stripe is still open, so nothing in the app depends on either.
`src/server/payments/provider.ts` defines the contract — create a session, verify a webhook,
return a normalised `PaymentEvent` — and there are three implementations behind
`CAMPAIGN_PAYMENTS_PROVIDER`:

| Value | Behaviour |
| --- | --- |
| `mock` | Redirects to `/checkout/mock`, which posts a self-signed webhook back. Exercises the real grant and mint path. |
| `paddle` | Paddle Billing. Merchant of Record, so Paddle is the seller — worth checking against DGR receipting before committing. |
| `stripe` | Stripe Checkout. Not Merchant of Record; Regen Sydney remains the seller. |

Switching providers is an env change. The grant ledger, idempotency and minting are all
downstream of the normalised event and do not care which one is live.

## Relayer

Minting needs a hot wallet authorised by RSUT's owner. The RS Core Team executor
(`0xEc5106fb6eA212305e487a9114c958ffE90E9a7a`) must call
`batchSetAuthorizedMinters([relayer], [true])` once, through a Hypha proposal.

Until then, leave `RSUT_RELAYER_PRIVATE_KEY` blank. Grants are still recorded and votes still
count — voting power reads the ledger, not the chain — and the mints sit at `pending`. The admin
Status tab shows the relayer's address, balance and authorisation, and can retry the backlog once
the authorisation lands.

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
