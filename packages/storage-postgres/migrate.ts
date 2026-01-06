import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { schema } from './src/schema';
import invariant from 'tiny-invariant';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
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
  const db = drizzle(pool, { schema });

  await migrate(db, { migrationsFolder: './migrations' });
  await pool.end();
}

main();
