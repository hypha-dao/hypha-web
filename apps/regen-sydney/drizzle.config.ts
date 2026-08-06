import { defineConfig } from 'drizzle-kit';

/**
 * The campaign's own migration chain, against the campaign's own database.
 *
 * Only `CAMPAIGN_DB*` names are read — never Hypha's `DEFAULT_DB_URL` or
 * `BRANCH_DB_URL`. That matters more here than anywhere else, because
 * `drizzle-kit push` applies DDL without asking.
 *
 * The unpooled endpoint is preferred over the pooled one the app uses at
 * runtime: migrations issue DDL over a single long connection, which is what
 * a direct endpoint is for and what a transaction-mode pooler handles badly.
 */
const url =
  process.env.CAMPAIGN_DB_URL ||
  process.env.CAMPAIGN_DB_DATABASE_URL_UNPOOLED ||
  process.env.CAMPAIGN_DB_DATABASE_URL;

if (!url) {
  throw new Error(
    'No campaign database configured (CAMPAIGN_DB_URL, or ' +
      'CAMPAIGN_DB_DATABASE_URL_UNPOOLED from the Neon integration). The ' +
      'campaign migrates its own database, separate from the Hypha platform — ' +
      'see apps/regen-sydney/README.md.',
  );
}

export default defineConfig({
  dbCredentials: { url },
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/server/db/schema.ts',
});
