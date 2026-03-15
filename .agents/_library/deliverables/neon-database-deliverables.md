### Neon Database Deliverables

| Artifact | Description |
|---|---|
| **Schema Definitions** | Drizzle schema files in `packages/storage-postgres/src/schema/` — one file per entity, separate `.relations.ts` for joins |
| **Migration Files** | Generated SQL in `packages/storage-postgres/migrations/` — produced by `drizzle-kit generate`, applied by `drizzle-kit migrate` |
| **Query Functions** | Typed query functions in `@hypha-platform/core` domain folders — accept `{ db: DatabaseInstance }` config |
| **Mutation Functions** | Typed mutation functions in `@hypha-platform/core` — wrapped by server actions with `'use server'` |
| **Connection Config** | `db.ts` with Neon Pool setup, local dev proxy config, and `Database` type export |
| **Branch Strategy** | Neon branching configuration aligned with CI workflows — preview branch naming, cleanup triggers, quota monitoring |
| **Migration CI Integration** | Drizzle migration steps in preview and production CI workflows — gated on `has_migrations` change detection |
| **Schema Diff PR Comments** | `neondatabase/schema-diff-action` output posted to PRs when migrations are detected |
| **Environment Variable Map** | Documentation of all Neon-related env vars (`BRANCH_DB_URL`, `DEFAULT_DB_URL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`) and their purpose per environment |
| **Seed Scripts** | `packages/storage-postgres/src/seed.ts` — reproducible test data for development and preview branches |
| **Performance Queries** | Optimized Drizzle queries with appropriate indexes, pagination via `PaginatedResponse<T>`, and connection pooling guidance |
