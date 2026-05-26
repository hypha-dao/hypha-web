# Banking migrations

## Layout (after `0048`)

| Migration | Purpose |
|-----------|---------|
| `0049_space_call_artifacts` | Call recordings / transcripts / discussion summaries |
| `0050_signal_orchestrator` | Signal orchestrator tables |
| `0051_document_state_memory` | `document_state` enum + `memory` |
| `0052_bank_customers` | **Only** `bank_customers` (Bridge-first / GDPR-minimal) |

There is **no** `0053+` banking migration. Do not run `drizzle-kit generate` unless you intend to add a new migration — a bad generate produced `0053_panoramic_firedrake` (DROP `bank_virtual_accounts`) when `meta/0051_snapshot.json` was out of sync.

## Apply migrations

```bash
pnpm --filter @hypha-platform/storage-postgres run migrate
```

You do **not** need `generate` before `migrate` if this repo matches your branch.

Run `generate` only after changing `src/schema/*`, then commit the new SQL + snapshot.

## Error: `relation "bank_virtual_accounts" does not exist`

That was migration **`0053_panoramic_firedrake`** (removed). It assumed legacy banking tables existed.

**Fix:**

1. Pull latest migrations (journal ends at `0052_bank_customers`; no `0053`).
2. Remove any failed `0053` row from Drizzle’s journal table on your DB:

```sql
DELETE FROM drizzle."__drizzle_migrations"
WHERE "hash" LIKE '%0053%';
```

(If your table/column names differ, inspect `SELECT * FROM drizzle."__drizzle_migrations" ORDER BY created_at DESC LIMIT 10;`.)

3. Re-run `pnpm --filter @hypha-platform/storage-postgres run migrate`.

## Fresh / messy dev DB

If you previously applied old banking migrations (`0053`–`0059` legacy chain) or have a broken `bank_customers` shape:

```sql
DROP TABLE IF EXISTS bank_transfers;
DROP TABLE IF EXISTS bank_virtual_accounts;
DROP TABLE IF EXISTS bank_customers;
```

Then clear `__drizzle_migrations` rows for `0052`+ if you need to re-apply, or reset the branch database and run `migrate` from scratch.

## Error: `relation "bank_customers" does not exist` (42P01)

**Not a Neon cache issue.** Postgres has no DDL cache to clear. This almost always means either:

1. **Drizzle thinks `0052` already ran** — you dropped `bank_customers` (or legacy tables) in the SQL editor, but `__drizzle_migrations` still has a row for `0052_bank_customers`, so `pnpm … run migrate` skips it.
2. **`migrate` targeted a different database than the app** — `drizzle.config.ts` uses `BRANCH_DB_URL || DEFAULT_DB_URL` (owner role). The app uses `DEFAULT_DB_AUTHENTICATED_URL` (same Neon **endpoint host**, different role + JWT). Compare hostnames; they must be the same branch.

### Diagnose (Neon SQL Editor on the branch your app uses — host must match `DEFAULT_DB_AUTHENTICATED_URL`)

```sql
SELECT to_regclass('public.bank_customers') AS bank_customers_exists;

-- Drizzle Kit (PostgreSQL) stores the journal in schema `drizzle`, not `public`
SELECT id, hash, created_at
FROM drizzle."__drizzle_migrations"
ORDER BY created_at DESC
LIMIT 8;
```

If that errors with “relation does not exist”, find where (if anywhere) the journal lives:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name ILIKE '%drizzle%migration%';
```

No rows → migrations have never been applied on **this** database (or you are on the wrong branch). Run `pnpm --filter @hypha-platform/storage-postgres run migrate` with the owner URL for the same host the app uses.

- `bank_customers_exists` is `NULL` and the latest migration row is already `0052` → case (1) below.
- `bank_customers_exists` is `NULL` and there is **no** `0052` row → run migrate with owner URL pointing at this branch (case 2 or never migrated).
- Host in app logs (`getDb` debug URL) differs from `BRANCH_DB_URL` / `DEFAULT_DB_URL` → fix env, then migrate on the app branch.

### Fix case (1): re-apply `0052` only

```sql
DROP TABLE IF EXISTS bank_transfers;
DROP TABLE IF EXISTS bank_virtual_accounts;
DROP TABLE IF EXISTS bank_customers;

-- Remove only the 0052 journal row (inspect hashes first; delete the newest row if it is 0052)
DELETE FROM drizzle."__drizzle_migrations"
WHERE id = (
  SELECT id FROM drizzle."__drizzle_migrations"
  ORDER BY created_at DESC
  LIMIT 1
);
-- If the latest row is NOT 0052, delete the row whose created_at matches when you first applied banking instead.
```

Then from repo root (owner URL for **this** branch in `packages/storage-postgres/.env` or shell):

```bash
pnpm --filter @hypha-platform/storage-postgres run migrate
```

Confirm: `SELECT to_regclass('public.bank_customers');` should return `bank_customers`.

### Fix case (2): full dev branch reset (optional, cleanest E2E)

In Neon console: reset the dev branch (or create a new branch), then repeat `context/technical/dev-setup.md` §5 (roles → `pg_session_jwt` → `migrate` → `GRANT`s → JWKS). No merge from main unless you intend to.
