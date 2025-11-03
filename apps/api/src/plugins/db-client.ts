import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';
import { schema } from './db-schema';

export function newDbClient(connectionString: string) {
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

export type Database = ReturnType<typeof newDbClient>;
