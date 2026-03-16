### Neon Database Engineering

#### Neon Serverless Postgres

- **Platform:** Neon — serverless Postgres with autoscaling, branching, and instant restore
- **Driver:** `@neondatabase/serverless` — WebSocket-based connection pooling for edge/serverless runtimes
- **ORM:** Drizzle ORM (`drizzle-orm/neon-serverless`) with typed schema definitions and relational queries
- **Migration tooling:** `drizzle-kit generate` (schema diffing), `drizzle-kit migrate` (apply), `drizzle-kit push` (direct schema sync)
- **Connection strategy:** Pooled via `Pool` from `@neondatabase/serverless`; `BRANCH_DB_URL` takes precedence over `DEFAULT_DB_URL`

#### Neon Branching

- **Copy-on-write:** Branches are instant, zero-cost copies of the parent database — no data duplication until writes diverge
- **Preview branching:** Each PR gets an isolated `preview/pr-{number}-{branch}` Neon branch with its own connection string
- **Branch lifecycle:** Created on PR open → migrations applied → used for preview deployment → deleted on PR close
- **Schema diff:** `neondatabase/schema-diff-action` posts migration diffs as PR comments for review
- **Branch limits:** Plan-dependent; monitor usage to avoid hitting quotas on active branches
- **Archive behavior:** Idle branches are archived automatically — consumes archive storage, not compute

#### Vercel + Neon Integration

- **Vercel-Managed Integration:** Neon Postgres installed from Vercel Marketplace; billing consolidated in Vercel
- **Environment variable injection:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` auto-injected per environment
- **Preview deployment branching:** Vercel webhook triggers Neon to create `preview/<git-branch>` — connection variables injected at deployment time only (not stored in Vercel project settings)
- **Branch cleanup:** Preview branches auto-delete when last deployment for a Git branch is deleted; configurable via Vercel retention policy (default 180 days)
- **Build-time migrations:** Migration commands added to Vercel build step ensure schema matches code per preview deployment

#### Next.js + Neon Patterns

- **Server components:** Use `@neondatabase/serverless` Pool directly — no cold-start penalty with Neon's WebSocket protocol
- **Server actions:** Database mutations through `'use server'` actions in `@hypha-platform/core` — pass `{ db: DatabaseInstance }` config, never import `db` directly
- **Edge runtime:** Neon's serverless driver supports edge functions — WebSocket connection via `neonConfig.webSocketConstructor`
- **Local development:** `neonConfig.wsProxy` points to local proxy (`host:5433/v1`) with TLS/pipeline disabled for local Postgres compatibility
- **Connection string hierarchy:** `BRANCH_DB_URL` (preview) → `DEFAULT_DB_URL` (production/development fallback)

#### Drizzle ORM Integration

- **Schema location:** `packages/storage-postgres/src/schema/` — one file per entity with separate `.relations.ts` files
- **Migration output:** `packages/storage-postgres/migrations/` — generated SQL files tracked in git
- **Config:** `packages/storage-postgres/drizzle.config.ts` — dialect `postgresql`, schema and output paths
- **Type export:** `Database` type exported from `db.ts` — consumed as `DatabaseInstance` parameter across `core` package
- **Relational queries:** Drizzle's relational query API for joins; raw SQL only when query builder is insufficient
