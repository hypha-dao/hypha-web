# Regen Sydney — crowdfunding and voting

A standalone Next.js app (port 3002) where supporters contribute in AUD, receive RSUT, and use
it to vote on which Regen Sydney projects the pooled funds go to.

It lives in this monorepo for convenience, not for coupling. It has **its own database**, renders
its own `<html>`, and imports none of Hypha's runtime packages. The one thing it shares is the
Privy app, so a contributor who also uses Hypha keeps a single identity. See
[Isolation from the Hypha platform](#isolation-from-the-hypha-platform).

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

`CAMPAIGN_DB_URL` and `PRIVY_APP_SECRET` are the only two variables you need for a useful local
run. Everything else has a working default — see `.env.template`, which documents each one.

### Local database

The app talks to Postgres through Neon's serverless driver, so locally it needs Neon's websocket
proxy in front of a plain Postgres. `src/server/db/index.ts` switches to the proxy automatically
when the connection string points at localhost.

```bash
docker run -d --name rs-pg -e POSTGRES_PASSWORD=postgres -p 55499:5432 postgres:16
docker run -d --name rs-neon-proxy --link rs-pg -p 5433:4444 \
  -e PG_CONNECTION_STRING=postgres://postgres:postgres@rs-pg:5432/regen_sydney \
  ghcr.io/timowilhelm/local-neon-http-proxy:main
docker exec rs-pg psql -U postgres -c 'CREATE DATABASE regen_sydney;'
```

Then `CAMPAIGN_DB_URL=postgres://postgres:postgres@localhost:5432/regen_sydney`. The port in that
URL is ignored — the driver routes through the proxy on 5433 — but the host must say `localhost`
for the switch to trigger.

Keep `.env` pointed at this local database and nothing else. The deployed connection string lives
in `.env.neon`, read only by the `:deployed` scripts described under [Deploying](#deploying).

Migrations are the campaign's own, in `./migrations`, on their own chain:

```bash
pnpm --filter regen-sydney db:generate   # after changing src/server/db/schema.ts
pnpm --filter regen-sydney db:migrate
```

### Tests

```bash
CAMPAIGN_DB_URL=postgres://postgres:postgres@localhost:5432/regen_sydney \
  pnpm --filter regen-sydney test
```

The campaign tests run against that same Postgres rather than mocks, because the behaviour worth
checking — grant idempotency, the one-open-round constraint, atomic ballot replacement — is
enforced by the database. Each run parks the development data, creates its own members, projects
and round, and puts everything back afterwards, so running it against a seeded database is safe.

Without a connection string those are skipped and only the suites that need none run: the Stripe
webhook checks, and the isolation guard tests described below.

## Checkout

Stripe is the provider. It is reached through the adapter in
`src/server/payments/provider.ts` — create a session, verify a webhook, return a normalised
`PaymentEvent` — so the grant ledger, idempotency and minting never mention Stripe by name.
`CAMPAIGN_PAYMENTS_PROVIDER` still selects between:

| Value    | Behaviour                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `stripe` | Stripe Checkout. Not Merchant of Record, so Regen Sydney stays the seller — which keeps DGR receipting straightforward.               |
| `mock`   | Redirects to `/checkout/mock`, which posts a self-signed webhook back. Exercises the real grant and mint path with no Stripe account. |
| `paddle` | Kept working but unused. Merchant of Record, which complicates DGR receipting.                                                        |

### Connecting the Stripe sandbox

1. In the Stripe dashboard, switch to a **sandbox** (or test mode) and create a key. A restricted
   key (`rk_test_…`) is preferable to a full secret key: the only write the app performs is
   creating a Checkout Session, so that is the only write scope it needs. `sk_test_…` also works.

   To let the Stripe CLI work with the same key, give it **Debugging Tools write**
   (`stripecli_session_write`) as well; without that, `stripe listen` gets a 403. Grant
   **Webhook Endpoints write** too if you want to manage endpoints from a script.

   `node scripts/stripe-permissions.mjs` reports what a key can actually do — Stripe has no
   endpoint that lists a key's scopes, so it finds out by trying each one.

2. Get a webhook secret. Locally that means the Stripe CLI:

   ```bash
   stripe login   # or rely on the key above, if it has Debugging Tools write
   node scripts/stripe-webhook-secret.mjs   # writes whsec_… into .env, prints nothing secret
   stripe listen --forward-to localhost:3002/api/webhooks/payments
   ```

   Deployed, register the endpoint from a script instead:

   ```bash
   node scripts/stripe-webhook-endpoint.mjs             # show the plan
   node scripts/stripe-webhook-endpoint.mjs --execute   # preview
   node scripts/stripe-webhook-endpoint.mjs --target production --execute
   ```

   It subscribes the three events above and writes the signing secret straight into
   `STRIPE_WEBHOOK_SECRET` on the Vercel project, without printing it — Stripe returns that secret
   once and never again, so a copy in a scrollback is a liability with no upside.

   For preview it targets `regen.preview-app.hypha.earth` (see below) rather than a deployment
   URL, since a deployment URL stops existing at the next push and the endpoint would go quietly
   dead. `NEXT_PUBLIC_APP_URL` is set per environment to match, so returning from Checkout lands
   back where you started.

3. Put both in `.env` alongside `CAMPAIGN_PAYMENTS_PROVIDER=stripe`.
4. Check the wiring, with the dev server running:

   ```bash
   pnpm --filter regen-sydney stripe:check
   ```

   It refuses a live key, opens a throwaway A$25 session against the real Stripe API, replays a
   correctly signed webhook at the local app, confirms a redelivery of that same event is
   recognised rather than granted twice, and confirms a tampered one is rejected.

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

## Deploying

The Vercel project is `regen-sydney` under the **Hypha DAO** team
(`prj_VDfqcWlLDmezeTIXTBFJOkHrhxEe`), deployed from `apps/regen-sydney` as its root directory.

The campaign's database is provisioned as a **Neon resource on that project**, which keeps it in a
different Neon project from the platform's and bills through Vercel. Provision it from this
directory — not from the repository root, which is linked to a different Vercel project:

```bash
cd apps/regen-sydney
vercel integration add neon      # asks for region and plan
```

Give the integration `CAMPAIGN_DB` as its **variable prefix**, and attach it to Production and
Preview only. It then publishes its whole set of variables under that prefix, of which two matter:

| Variable                            | Used by                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `CAMPAIGN_DB_DATABASE_URL`          | the app at runtime — Neon's pooled endpoint, right for serverless |
| `CAMPAIGN_DB_DATABASE_URL_UNPOOLED` | `pnpm db:migrate` — a direct endpoint, right for DDL              |

Both are read as fallbacks after `CAMPAIGN_DB_URL`, so a deployed environment needs nothing set by
hand. The integration marks its values _sensitive_, meaning they cannot be read back out of Vercel
at all — copying one into `CAMPAIGN_DB_URL` is not possible, which is why the app accepts the
integration's own names. Every name it will read still begins `CAMPAIGN_DB`; none is a name Hypha
sets.

Migrating and seeding needs the connection string, and since Vercel will not hand it back, take it
from the Neon console — **Open in Neon** on the resource page, then **Connect**, with connection
pooling switched off. Put it in `.env.neon`, which is gitignored, as a single `CAMPAIGN_DB_URL=`
line. Deliberately not in `.env`: that file is what `pnpm dev` and the integration tests read, and
those tests write and delete rows.

```bash
pnpm db:check:deployed      # empty, and none of Hypha's tables?
pnpm db:migrate:deployed
pnpm seed:deployed
```

Each of those reads `.env.neon` and nothing else, so the deployed database can only be touched by
asking for it by name.

The other variables the deployed app needs are `PRIVY_APP_SECRET`, `CAMPAIGN_ADMIN_EMAILS`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RSUT_RELAYER_PRIVATE_KEY` and `NEXT_PUBLIC_APP_URL`.
`.env.template` documents each.

### Why preview runs on a hypha.earth subdomain

Preview deploys are reached at **`regen.preview-app.hypha.earth`**, pinned to this branch so it
follows the newest deployment, rather than at the `*.vercel.app` alias Vercel generates.

That is not cosmetic. The shared Privy app uses a custom auth domain at `privy.hypha.earth`, and
its session cookies carry `Domain=privy.hypha.earth; SameSite=None; Secure`. Browsers decide
first- versus third-party by _site_, not origin: from `app.hypha.earth` — or any other
`hypha.earth` subdomain — those cookies are first-party and are sent. From `*.vercel.app` they are
not, because `vercel.app` is on the Public Suffix List, so every deployment is its own site.

The failure that causes is quiet and misleading. Login succeeds, because the Privy modal runs in a
top-level context where the cookie is first-party. `authenticated` becomes `true`. But
`getAccessToken()` then has no refresh cookie to work with and returns `null` forever, so every
API call goes out without a bearer token and the app looks signed out while Privy insists
otherwise.

The subdomain needed no DNS work — `*.preview-app.hypha.earth` already resolves to Vercel — and no
Privy change, since `https://*.preview-app.hypha.earth` is already an allowed domain.

**Production will need the same treatment.** `regen-sydney.vercel.app` will hit this exact wall;
the campaign needs a `hypha.earth` subdomain, or a Privy app of its own.

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
    db/              schema and connection for the campaign's own database
    payments/        provider interface + mock, paddle, stripe
    chain/           RSUT ABI and relayer mint
    auth.ts          Privy verification, member upsert, admin gate
    config.ts        env reading and validation
    hypha-profiles.ts  read-only profile lookups over Hypha's public API
migrations/          the campaign's own migration chain
```

## Isolation from the Hypha platform

The campaign takes money and counts votes; Hypha is the platform of record for live DAOs. A bug
here — a careless migration, a runaway seed, a bad delete — must not be able to damage that. So
the two are kept apart deliberately, and in more than one way, because a single mechanism is a
single point of failure.

**Its own database.** Every table the campaign owns is prefixed `campaign_` and lives in its own
Neon project, with its own migration chain in `./migrations`. Nothing in
`packages/storage-postgres` mentions the campaign, so running Hypha's migrations never creates a
campaign table and vice versa.

**Its own connection variables.** The campaign reads `CAMPAIGN_DB_URL`, then the Neon
integration's `CAMPAIGN_DB_DATABASE_URL`, and never Hypha's `DEFAULT_DB_URL` or `BRANCH_DB_URL`.
Those names are not referenced anywhere in this app, so an unset variable cannot silently fall
back to the platform database — it fails loudly instead. The same is true of `drizzle.config.ts`,
which matters because `drizzle-kit push` applies DDL without asking.

**A guard against the remaining human error.** The one way left to get this wrong is to paste
Hypha's connection string into one of those two while setting up a deploy. Startup compares
whichever it resolved against every Hypha variable present and refuses to build a client if they
match. `src/server/db/__tests__/guard.test.ts` covers this and needs no database to run.

**A pre-deploy check that looks at the database itself**, rather than trusting the variable name:

```bash
pnpm --filter regen-sydney db:check              # reads .env
pnpm --filter regen-sydney db:check .env.production
```

It fails if Hypha's tables (`people`, `spaces`, `documents`…) are present, and tells you if the
campaign's migrations have not run. Reads only — it creates and alters nothing. Worth running
against any new connection string before pointing a deploy at it.

**No Hypha packages at runtime.** The app imports no `@hypha-platform/*` runtime package — only
the shared ESLint and TypeScript configs, which are build-time only. There is no code path from
here into Hypha's schema.

### What is shared, and how

|                 | Mechanism                                     | Direction                               |
| --------------- | --------------------------------------------- | --------------------------------------- |
| Identity        | The same Privy app, so the same `sub`         | Neither app reads the other's store     |
| Profile details | `GET /api/v1/people/by-web3-address/:address` | Read-only, unauthenticated, best-effort |
| RSUT            | The token contract on Base                    | On-chain, shared by definition          |

Profile enrichment follows the same rule as the ACAW integration in
`docs/integrations/external-signal-ingestion.md`: match an existing profile, never create one. The
campaign holds no Hypha credential, so it could not write even if asked to. A contributor who
wants a Hypha profile creates it on Hypha.
