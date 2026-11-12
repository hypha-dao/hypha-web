import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import { WebSocket } from 'ws';

/** Minimal pool surface used by this package (satisfied by both pg and Neon pools). */
export type AuthDbPool = pg.Pool;

/**
 * Better Auth reads `expiresAt` and the like as `Date` objects (`key.expiresAt.getTime()`).
 * Under the Next dev server the Neon driver handed back timestamptz as strings, which made the
 * JWKS endpoint answer 500. Pin the parser so it does not depend on the bundled driver defaults.
 */
const TIMESTAMPTZ_OID = 1184;
const timestamptzAsDate = {
  getTypeParser: (oid: number, format?: 'text' | 'binary') =>
    oid === TIMESTAMPTZ_OID
      ? (value: string) => new Date(value)
      : pg.types.getTypeParser(oid, format as 'text'),
};

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
  return new NeonPool({
    connectionString,
    max: 5,
    types: timestamptzAsDate as never,
  }) as unknown as AuthDbPool;
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

/**
 * Which Hypha person a provider account belongs to. The link lives in `as_identity`
 * (provider, provider user id) -> people.sub, so one person can have several providers and
 * a provider can be swapped without changing `sub`.
 *
 * Existing people are linked automatically for Privy only: today `people.sub` is the Privy
 * user id, so that mapping is already established data. Any other provider is never linked
 * automatically (that would let a new provider claim somebody else's person); links for
 * them are added by an explicit, authenticated step.
 */
export async function resolvePersonForIdentity(
  pool: AuthDbPool,
  provider: string,
  providerUserId: string,
): Promise<PersonRecord | null> {
  const linked = await pool.query<PersonRecord>(
    `select p.sub, p.name, p.surname, p.email
       from as_identity i join people p on p.sub = i."personSub"
      where i.provider = $1 and i."providerUserId" = $2 limit 1`,
    [provider, providerUserId],
  );
  if (linked.rows[0]) return linked.rows[0];
  if (provider !== 'privy') return null;
  const person = await findPersonBySub(pool, providerUserId);
  if (!person) return null;
  await pool.query(
    `insert into as_identity (provider, "providerUserId", "personSub")
     values ($1, $2, $3) on conflict do nothing`,
    [provider, providerUserId, person.sub],
  );
  return person;
}
