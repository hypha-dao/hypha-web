import { defineConfig } from 'drizzle-kit';

const url = process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL;

if (!url)
  throw new Error(
    `db connectionString (BRANCH_DB_URL or DEFAULT_DB_URL) is not set`,
  );

export default defineConfig({
  dbCredentials: { url },
  dialect: 'postgresql',
  out: './migrations',
  schema: './src/schema/index.ts',
});
