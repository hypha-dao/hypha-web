import type { AuthDbPool } from './db';

export type ConnectedApp = {
  clientId: string;
  name: string | null;
  uri: string | null;
  scopes: string[];
  connectedAt: Date;
};

/** Apps a person has approved: one row per client (consent record). */
export async function listConnectedApps(
  pool: AuthDbPool,
  personId: string,
): Promise<ConnectedApp[]> {
  const { rows } = await pool.query(
    `select c."clientId" as "clientId", cl.name as name, cl.uri as uri, c.scopes as scopes,
            c."createdAt" as "connectedAt"
       from as_oauth_consent c
       left join as_oauth_client cl on cl."clientId" = c."clientId"
      where c."userId" = $1
      order by c."createdAt" desc`,
    [personId],
  );
  return rows.map((r) => ({
    ...r,
    scopes: Array.isArray(r.scopes) ? r.scopes : JSON.parse(r.scopes ?? '[]'),
  }));
}

/**
 * Disconnects one app for one person: deletes the consent record and every refresh and opaque
 * access token for that pair, so the app cannot refresh any more. Already issued JWT access
 * tokens stay valid until they expire (they are short-lived and not revocable server-side).
 * Better Auth's own consent delete only removes the consent row and leaves refresh working: the
 * library does not tie refresh to consent. Deleting is deliberate: marking tokens `revoked`
 * instead does not keep an audit record, because the library treats a revoked refresh token that
 * is presented as reuse and deletes the whole token family anyway.
 */
export async function disconnectApp(
  pool: AuthDbPool,
  personId: string,
  clientId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      'delete from as_oauth_access_token where "userId" = $1 and "clientId" = $2',
      [personId, clientId],
    );
    await client.query(
      'delete from as_oauth_refresh_token where "userId" = $1 and "clientId" = $2',
      [personId, clientId],
    );
    await client.query(
      'delete from as_oauth_consent where "userId" = $1 and "clientId" = $2',
      [personId, clientId],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
