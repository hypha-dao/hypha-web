import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';
import { schema } from './schema';
import { loadEnvConfig } from '@next/env';
import path from 'path';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

type Database = NodePgDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;

const cwd = path.join(process.cwd(), '../../');
const { combinedEnv } = loadEnvConfig(cwd);

const connectionString =
  combinedEnv?.BRANCH_DB_URL || combinedEnv?.DEFAULT_DB_URL;

if (!connectionString) {
  throw new Error(
    'db connectionString (BRANCH_DB_URL or DEFAULT_DB_URL) is not set',
  );
}

let db: Database;

if (process.env.NODE_ENV === 'production') {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
} else {
  const client = new Client({ connectionString });
  client.connect();
  db = drizzleNode(client, { schema });
}

export { db };
export type { Database };
