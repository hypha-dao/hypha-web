import { applyMigrations } from '../migrate';
import { schema } from '../schema/index';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { afterAll, afterEach, beforeEach } from 'vitest';
import { reset } from 'drizzle-seed';
import { loadEnvConfig } from '@next/env';

const { combinedEnv } = loadEnvConfig(process.cwd());

const connectionString =
  combinedEnv?.BRANCH_DB_URL || combinedEnv?.DEFAULT_DB_URL;

let client: Client;
let db: NodePgDatabase<typeof schema>;

beforeEach(async () => {
  client = new Client({ connectionString });
  await client.connect();
  db = drizzle({ client, schema });
  await applyMigrations(db);
});

afterEach(async () => {
  await reset(db, schema);
});

afterAll(async () => {
  await client.end();
});

export { db };
