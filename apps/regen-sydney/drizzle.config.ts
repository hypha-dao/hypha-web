import { defineConfig } from 'drizzle-kit';

/**
 * The campaign's own migration chain, against the campaign's own database.
 *
 * Note the variable: `CAMPAIGN_DB_URL`, never Hypha's `DEFAULT_DB_URL` or
 * `BRANCH_DB_URL`. Those names are not read here, so `drizzle-kit push` run
 * from this directory cannot reach the platform database even by accident —
 * which matters, because push applies DDL without asking.
 */
const url = process.env.CAMPAIGN_DB_URL;

if (!url) {
  throw new Error(
    'CAMPAIGN_DB_URL is not set. The campaign migrates its own database, ' +
      'separate from the Hypha platform — see apps/regen-sydney/README.md.',
  );
}

export default defineConfig({
  dbCredentials: { url },
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/server/db/schema.ts',
});
