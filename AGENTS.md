# Hypha Platform — Agent Instructions

Turborepo + pnpm monorepo for the Hypha DAO platform (Web3/Base L2).

## Cursor Cloud specific instructions

### Services overview

| Service | Path | Dev command | Port | Notes |
|---------|------|-------------|------|-------|
| **Web** (Next.js 15) | `apps/web` | `pnpm dev` (from root) or `cd apps/web && pnpm dev` | 3000 | Requires `DEFAULT_DB_URL` for pages that touch DB |
| **API** (Fastify 5) | `apps/api` | `cd apps/api && pnpm dev` | 3001 | Health at `GET /health` (not under `/api/v1`). Swagger at `/api/v1/docs` when DB is configured |

### Key commands (from repo root)

- **Install**: `pnpm install`
- **Lint**: `pnpm lint` (runs ESLint across all packages via Turbo)
- **Dev**: `pnpm dev` (starts both web and API via Turbo)
- **Build**: `pnpm build` (production build; requires `DEFAULT_DB_URL` for page data collection)
- **Unit tests**: `npx vitest run --globals` (no vitest config file; use `--globals` flag for `describe`/`it`)

### Gotchas

- The `.env.template` files in `apps/web` and `apps/api` are auto-copied to `.env` on `postinstall` if `.env` doesn't exist. If you need to reset env vars, delete `.env` and re-run `pnpm install`.
- The web app **requires** `DEFAULT_DB_URL` (or `BRANCH_DB_URL`) set to a Neon Postgres connection string for any page that touches the database (most pages). Without it, pages return a 500 with "Invariant failed: db connectionString … is not set". The dev server itself still starts and compiles fine.
- The API requires `DEFAULT_DB_URL`, `DEFAULT_DB_AUTHENTICATED_URL`, and `DEFAULT_DB_ANONYMOUS_URL` for full functionality. Without them it starts and the `/health` endpoint works, but routes that need DB will fail.
- `pnpm build` (production) will fail at the "Collecting page data" step if `DEFAULT_DB_URL` is not set, even though TypeScript compilation succeeds.
- Unit tests use `vitest` at the workspace root level. There is no `vitest.config` file; run with `npx vitest run --globals` to enable global test APIs (`describe`, `it`, `expect`).
- Hardhat tests in `packages/storage-evm` require a separate `npx hardhat test` invocation inside that package.
