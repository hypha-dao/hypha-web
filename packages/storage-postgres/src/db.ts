import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';
import { schema } from './schema';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import invariant from 'tiny-invariant';

type Database = NeonHttpDatabase<typeof schema>;

function createDb() {
  const connectionString =
    process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL;

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
  return drizzle(pool, { schema });
}

type AppDatabase = ReturnType<typeof createDb>;

let cached: AppDatabase | undefined;

function getAppDatabase(): AppDatabase {
  if (!cached) cached = createDb();
  return cached;
}

/**
 * Do not connect at import time. Route modules import this package through
 * `@hypha-platform/core/server`, and a missing URL used to throw before the
 * handler could return a 500. Callers then looked the same as "no profile".
 */
export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const instance = getAppDatabase();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export type { Database };
