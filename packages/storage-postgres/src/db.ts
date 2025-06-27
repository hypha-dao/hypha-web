import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';
import { schema } from './schema';
import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import invariant from 'tiny-invariant';

type Database = NeonHttpDatabase<typeof schema>;

const cwd = path.join(process.cwd(), '../../');
const { combinedEnv } = loadEnvConfig(cwd);

const connectionString =
  combinedEnv?.BRANCH_DB_URL || combinedEnv?.DEFAULT_DB_URL;

invariant(
  connectionString,
  'db connectionString (BRANCH_DB_URL or DEFAULT_DB_URL) is not set',
);

if (connectionString.includes('localhost')) {
  neonConfig.wsProxy = (host) => `${host}:5433/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
} else {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.poolQueryViaFetch = true;
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export type { Database };
