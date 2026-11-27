# @hypha-platform/auth-server

An OAuth 2.1 authorization server (Better Auth) that lets third-party apps and AI hosts act for a
Hypha person with that person's consent. It signs people in with their existing Privy session,
issues short-lived access tokens (JWT, signed with a key set it publishes), and verifies them for
resource servers. It is off unless configured and, in a non-production Vercel environment, refuses to start.

It runs inside `apps/web` but is served on its **own host** (the issuer), never on the main host.
Requests on any other host get a plain 404.

## Environment variables

Names and meaning only; see `apps/web/.env.template` for the full comments.

| Variable                         | Meaning                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SERVER_ENABLED`            | `true` turns the server on. Anything else: every route answers 404.                                                                        |
| `AUTH_SERVER_ISSUER`             | Path-less issuer URL on its own host (`http://auth.localhost:3000` locally).                                                               |
| `AUTH_SERVER_SECRET`             | At least 32 random characters, dedicated to this server. Signs cookies and protects the stored signing keys; rotating it invalidates them. |
| `AUTH_SERVER_ALLOWED_PERSON_IDS` | Comma-separated person ids (Privy user ids) allowed to connect apps. Empty allows nobody.                                                  |
| `AUTH_SERVER_RESOURCES`          | Comma-separated resource indicators (RFC 8707) tokens may be issued for.                                                                   |
| `AUTH_SERVER_CORS_ORIGINS`       | Comma-separated exact browser origins allowed to call the token (and, if on, registration) endpoints cross-origin. Default empty.          |
| `AUTH_SERVER_DCR_ENABLED`        | `true` enables restricted dynamic client registration. Otherwise the register path is 404 and the metadata does not advertise it.          |
| `MCP_WRITES_ENABLED`             | `true` lets the MCP resource accept `signals:write`. Otherwise it is not offered or issued for `/mcp`, and the next refresh drops it.      |

It also reads the app's existing database and Privy settings. The tables come from migration `0103_auth_server.sql` (all prefixed `as_`).

## Endpoints

All under `/api/auth` on the issuer host, plus the discovery document.

- `GET /.well-known/oauth-authorization-server`: server metadata.
- `GET /api/auth/jwks.json`: the public key set.
- `GET|POST /api/auth/oauth2/authorize`, `POST /oauth2/consent`, `POST /oauth2/continue`: the authorization-code flow (PKCE).
- `POST /api/auth/oauth2/token`, `POST /oauth2/revoke`.
- `POST /api/auth/oauth2/register`: only when `AUTH_SERVER_DCR_ENABLED=true`.
- `GET /api/auth/error`: plain-text error page.

Login and consent pages live at `/auth/login` and `/auth/consent`. Everything else the library
ships (client management, userinfo, introspection, session listing) is blocked.

## Resources

No resource is protected yet. A resource (for example the MCP server or the API) adopts `guardResource` from `@hypha-platform/auth-server/server` in its own route and is listed in `AUTH_SERVER_RESOURCES`; tokens are issued only for listed resources. Each resource belongs to a channel with its own list of accepted scopes (`allowedScopesForResource` in `src/config.ts`): the resource whose path is `/mcp` is the MCP channel (`spaces:read`, `offline_access`, plus `signals:write` while `MCP_WRITES_ENABLED` is `true`); every other resource is the API channel (`spaces:read`, `agreements:vote`, `offline_access`). The library applies the list at token time and at every refresh, and the consent page offers only those scopes.

## Clients and scopes

- **Metadata-document clients (CIMD):** the `client_id` is an HTTPS URL; the consent page shows the proven host.
- **Registered clients:** pre-approved by Hypha. A row counts as registered only when it is marked `metadata.registration = 'registered'`; a row with no marker and no metadata-document id is treated like a dynamically registered client (least trusted).
  The list of registered clients is `src/registered-clients.ts` (Cursor: client id `hypha-cursor`, redirect `cursor://anysphere.cursor-mcp/oauth/callback`, scopes `spaces:read`, `signals:write` and `offline_access`; public client, PKCE, no secret). A change to a client's scopes takes effect only after the list is applied again. Nothing creates the rows at runtime: a person applies the list with `seedRegisteredClients({ db })` (one idempotent upsert per client) against the database they choose. To add a redirect an app is known to send, add it to that client's `redirectUris` and apply again. Dynamic registration is separate and still accepts only https or loopback redirects.
- **Onboarding log lines:** one line per authorize, consent and token step: `[auth-server:onboarding] client_kind=... step=... error=... redirect_host=...`. Built from an allow-list (`onboardingLogLine` in `src/redact.ts`): no token, code, free text, full redirect URL or email.
- **Dynamically registered clients (optional):** anonymous public clients, capped, cleaned up after 7 days; the consent page shows the name as claimed, not proven.

Scopes: `spaces:read`, `agreements:vote`, `signals:write`, `offline_access`. The write scope
`agreements:vote` starts unticked for clients that are not pre-approved; `signals:write` starts
unticked for every client. `signals:write` acts in the spaces chosen under `spaces:read` (the same
per-space grant), so an approval of it without `spaces:read` is refused, and a first authorize
request that asks for it also asks for `spaces:read`.

Each kind of client has its own scope list (`src/config.ts`): a registered client its row, a
metadata-document client `CIMD_ALLOWED_SCOPES` (every scope, `signals:write` included), a dynamically
registered client `DCR_ALLOWED_SCOPES` (no `signals:write`). The library stores one list on every client
it registers itself (`CLIENT_REGISTRATION_CEILING_SCOPES`, the union); dynamic registrations are
narrowed to their list when created, and the consent page offers and accepts only the scopes of the
client's kind.

Access tokens carry `space_grants` (the chosen spaces) and `client_name` (the name the client
declared for itself, cleaned and capped at 120 characters, unverified). Access tokens last 10 minutes; refresh tokens
slide over 90 days. The approval link lasts 10 minutes, the authorization code 60 seconds.

## Language

The login and consent pages are translated (the `AuthServer` namespace in `packages/i18n`, 8 languages) but keep one path for everyone, with no `/<lang>/` prefix. The language comes from `?lang=` on the page, then a cookie (`hypha_as_lang`) that remembers it, then the browser's Accept-Language, then English. `?lang=` is read as a page setting only when the signed authorization query is still valid without it. The plain-text error page served at `/api/auth/error` is English only.

## Tests

Tests that need a database are skipped unless `AUTH_SERVER_TEST_DATABASE_URL` is set in the
**process environment**. Use a throwaway database that already has the app schema (with
`0103_auth_server.sql` applied); the suite seeds its own rows. Do not source an env
file with `&` in values into the shell.

```powershell
$env:AUTH_SERVER_TEST_DATABASE_URL = '<throwaway database url>'
pnpm --filter @hypha-platform/auth-server test
```

Without the variable, `pnpm test` runs the tests that need no database and skips the rest.

## Consent, disconnect and secrets

- **Consent is remembered** per client and scope until the person disconnects the app. It is asked again only when a request needs a scope that was not approved yet. `skip_consent` cannot be set.
- **After a disconnect** the refresh token stops working at once, but an access token already issued stays valid for up to its 10 minute lifetime. The allowlist (`AUTH_SERVER_ALLOWED_PERSON_IDS`) is checked on every request.
- **`AUTH_SERVER_SECRET`** also encrypts the stored signing key. Rotating it means clearing the `as_jwks` table, after which everyone signs in again.
- **Client address:** the per-address registration budget uses only Vercel's `x-vercel-forwarded-for` header, and only when `VERCEL` is set. Anywhere else every request counts as one address.
- **Registration budgets:** both the per-address and the server-wide hourly budgets are reserved in the database (`as_registration_slot`) under an advisory lock, so they are exact across instances and a concurrent burst cannot exceed them. Addresses are stored only as a hash and slots expire after an hour.
- **Approval is bound to the account shown:** the consent page sends the id of the account it displayed; an approval from a different session (for example after a sign-in in another tab) is refused with `account_changed` before anything is stored. The person is told to sign out first to switch accounts.
