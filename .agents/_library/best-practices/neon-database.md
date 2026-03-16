### Neon Database Best Practices

#### Do

- Always resolve `BRANCH_DB_URL` before `DEFAULT_DB_URL` — preview branches must use their isolated connection
- Use Drizzle query builder for all standard CRUD — raw SQL only for complex CTEs, window functions, or performance-critical paths
- Generate migrations with `drizzle-kit generate` after every schema change — never hand-write migration SQL
- Keep migration files small and single-concern — one logical change per migration
- Use `Pool` from `@neondatabase/serverless` for connection pooling — never create per-request connections
- Pass `{ db: DatabaseInstance }` as config parameter to queries and mutations — keeps database injectable and testable
- Gate Neon branch creation in CI on `has_migrations == 'true'` — avoid wasting branch quota on non-schema PRs
- Test migrations against a Neon branch before merging — catch schema conflicts early
- Set `neonConfig.poolQueryViaFetch = true` for production — enables HTTP-based query pipelining for better latency
- Monitor branch count against plan limits — archive or delete stale branches proactively
- Use `neondatabase/schema-diff-action` in PRs — makes schema changes visible to reviewers

#### Avoid

- Importing `db` directly in query files — breaks testability and couples to a single connection
- Creating Neon branches unconditionally in CI — wastes quota when no migrations exist
- Writing `BRANCH_DB_URL` to `.env` files in CI — risk of secret exposure in logs; pass as environment variable to the command
- Using `neon-http` driver for transactions — HTTP driver does not support multi-statement transactions; use `neon-serverless` Pool
- Mixing pooled and unpooled connections in the same request — pick one strategy per code path
- Hand-editing generated migration SQL — changes will be overwritten on next `drizzle-kit generate`
- Ignoring branch cleanup on PR close — leaked branches consume quota and archive storage
- Running `drizzle-kit push` against production — use `migrate` with versioned migration files for production deployments
- Hardcoding connection strings — always read from environment variables

#### Vercel + Next.js Specific

- Run migrations in Vercel build step (`npx drizzle-kit migrate && next build`) — ensures preview schema matches branch code
- Use `DATABASE_URL` (pooled/PgBouncer) for application queries — use `DATABASE_URL_UNPOOLED` only for migrations and schema operations
- Verify preview branch is ready before deployment — enable "Resource must be active before deployment" in Vercel integration settings
- Never store branch-specific connection variables in Vercel project settings — they are injected per-deployment by the integration webhook
- Use Neon's autoscaling and scale-to-zero for preview branches — minimizes cost for idle preview environments
