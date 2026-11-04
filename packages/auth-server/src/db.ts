import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import { WebSocket } from 'ws';

/** Minimal pool surface used by this package (satisfied by both pg and Neon pools). */
export type AuthDbPool = pg.Pool;

/**
 * One pool per process. Local databases use plain `pg`; hosted ones use the Neon serverless
 * driver (WebSocket pool), as the rest of the app does.
 */
export function createAuthDbPool(connectionString: string): AuthDbPool {
  const host = new URL(connectionString).hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return new pg.Pool({ connectionString, max: 5 });
  }
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.poolQueryViaFetch = true;
  return new NeonPool({ connectionString, max: 5 }) as unknown as AuthDbPool;
}

export type PersonRecord = {
  sub: string;
  name: string | null;
  surname: string | null;
  email: string | null;
};

/** The Hypha person record for a Privy user id. `people.sub` is the one identity key. */
export async function findPersonBySub(
  pool: AuthDbPool,
  sub: string,
): Promise<PersonRecord | null> {
  const { rows } = await pool.query<PersonRecord>(
    'select sub, name, surname, email from people where sub = $1 limit 1',
    [sub],
  );
  return rows[0] ?? null;
}
