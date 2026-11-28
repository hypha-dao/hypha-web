import type { AuthDbPool } from './db';
import { classifyClient, type ClientKind } from './consent';
import { replaceGrantIn, type GrantValue } from './grants';

/** One space an app may use, as the connected-apps page names it. */
export type ConnectedAppSpace = { id: number; title: string; slug: string };

export type ConnectedApp = {
  /**
   * The handle the connected-apps page acts on: the person's consent record id. The page never
   * shows or sends the client id; an action names this id and is checked against the person.
   */
  id: string;
  clientId: string;
  name: string | null;
  uri: string | null;
  kind: ClientKind;
  scopes: string[];
  /** 'all', the spaces of an explicit grant, or null when the app has no grant (reads nothing). */
  spaces: 'all' | ConnectedAppSpace[] | null;
  connectedAt: Date;
  /** When the app last got a token (every refresh writes a new refresh token row). */
  lastActiveAt: Date | null;
};

const asArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as string[])
    : typeof value === 'string'
    ? (JSON.parse(value) as string[])
    : [];

/**
 * Apps a person has approved: one entry per consent record, newest first, with what each may
 * do and in which spaces. Only the person's own rows are read.
 */
export async function listConnectedApps(
  pool: Pick<AuthDbPool, 'query'>,
  personId: string,
): Promise<ConnectedApp[]> {
  const { rows } = await pool.query(
    `select c.id as id, c."clientId" as "clientId", cl.name as name, cl.uri as uri,
            cl."clientDiscoveryId" as "clientDiscoveryId",
            cl.metadata->>'registration' as registration,
            c.scopes as scopes, c."createdAt" as "connectedAt", g.mode as mode,
            (select max(r."createdAt") from as_oauth_refresh_token r
              where r."userId" = c."userId" and r."clientId" = c."clientId") as "lastActiveAt"
       from as_oauth_consent c
       left join as_oauth_client cl on cl."clientId" = c."clientId"
       left join as_client_grant g on g."userId" = c."userId" and g."clientId" = c."clientId"
      where c."userId" = $1
      order by c."createdAt" desc`,
    [personId],
  );
  const explicit = await pool.query<{
    clientId: string;
    id: number;
    title: string;
    slug: string;
  }>(
    `select gs."clientId" as "clientId", s.id as id, s.title as title, s.slug as slug
       from as_client_grant_space gs
       join spaces s on s.id = gs."spaceId"
      where gs."userId" = $1
      order by s.title, s.id`,
    [personId],
  );
  const spacesByClient = new Map<string, ConnectedAppSpace[]>();
  for (const row of explicit.rows) {
    const list = spacesByClient.get(row.clientId) ?? [];
    list.push({ id: row.id, title: row.title, slug: row.slug });
    spacesByClient.set(row.clientId, list);
  }
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    name: r.name ?? null,
    uri: r.uri ?? null,
    kind: classifyClient({
      clientDiscoveryId: r.clientDiscoveryId,
      registration: r.registration,
    }),
    scopes: asArray(r.scopes),
    spaces:
      r.mode === 'all'
        ? 'all'
        : r.mode === 'spaces'
        ? spacesByClient.get(r.clientId) ?? []
        : null,
    connectedAt: r.connectedAt,
    lastActiveAt: r.lastActiveAt ?? null,
  }));
}

/** Runs `work` in one transaction on its own connection. */
async function inTransaction<T>(
  pool: AuthDbPool,
  work: (tx: Pick<AuthDbPool, 'query'>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Every row of the pair that lets the app act or get tokens, consent first (see below). */
async function deletePair(
  tx: Pick<AuthDbPool, 'query'>,
  personId: string,
  clientId: string,
): Promise<void> {
  const pair = [personId, clientId];
  // Consent first: a token issued at the same time checks for it (`confirmStillConnected`) and
  // waits for this transaction; the token rows are deleted after, so one issued before the check
  // is removed here.
  await tx.query(
    'delete from as_oauth_consent where "userId" = $1 and "clientId" = $2',
    pair,
  );
  await tx.query(
    'delete from as_oauth_access_token where "userId" = $1 and "clientId" = $2',
    pair,
  );
  await tx.query(
    'delete from as_oauth_refresh_token where "userId" = $1 and "clientId" = $2',
    pair,
  );
  await tx.query(
    'delete from as_client_grant where "userId" = $1 and "clientId" = $2',
    pair,
  );
}

/**
 * Disconnects one app for one person: deletes the consent record, every refresh and opaque
 * access token and the space grant for that pair, in one transaction, so the app cannot refresh
 * any more. A token issued while this runs is refused by `confirmStillConnected`. Already issued
 * JWT access tokens stay valid until they expire (10 minutes; they cannot be revoked
 * server-side). Better Auth's own consent delete only removes the consent row and leaves refresh
 * working, so it is not used.
 */
export async function disconnectApp(
  pool: AuthDbPool,
  personId: string,
  clientId: string,
): Promise<void> {
  await inTransaction(pool, (tx) => deletePair(tx, personId, clientId));
}

/**
 * Disconnect from the connected-apps page: the app is named by its consent record id and must
 * belong to the person. Returns false when it does not (nothing is touched).
 */
export async function disconnectConnectedApp(
  pool: AuthDbPool,
  personId: string,
  appId: string,
): Promise<boolean> {
  return inTransaction(pool, async (tx) => {
    const { rows } = await tx.query<{ clientId: string }>(
      'select "clientId" from as_oauth_consent where id = $1 and "userId" = $2 for update',
      [appId, personId],
    );
    const clientId = rows[0]?.clientId;
    if (!clientId) return false;
    await deletePair(tx, personId, clientId);
    return true;
  });
}

export type ChangeSpacesResult = 'ok' | 'not_found' | 'no_read_scope';

/**
 * Changes which spaces a connected app may use, without disconnecting it. The new choice
 * replaces the stored grant exactly (it can narrow or widen, always by the person's explicit
 * choice) and reaches the app at its next token (refresh or re-authorization); access tokens
 * already issued keep the old list until they expire. Only an app of this person that was
 * approved with `spaces:read` can be changed: without it there is nothing to limit. The consent
 * row is locked exclusively while the grant is written, so two changes at the same time run one
 * after the other, and a disconnect at the same time cannot leave a grant behind.
 */
export async function changeConnectedAppSpaces(
  pool: AuthDbPool,
  personId: string,
  appId: string,
  value: GrantValue,
): Promise<ChangeSpacesResult> {
  return inTransaction(pool, async (tx) => {
    const { rows } = await tx.query<{ clientId: string; scopes: unknown }>(
      'select "clientId", scopes from as_oauth_consent where id = $1 and "userId" = $2 for update',
      [appId, personId],
    );
    const row = rows[0];
    if (!row) return 'not_found';
    if (!asArray(row.scopes).includes('spaces:read')) return 'no_read_scope';
    await replaceGrantIn(tx, personId, row.clientId, value);
    return 'ok';
  });
}

/**
 * Checked after every token the library issues (code exchange and refresh): the person still
 * has a consent record for the app. The library rotates a refresh token in two separate steps,
 * so a disconnect that lands between them would otherwise leave the new token usable. The
 * consent row is read with a share lock, which waits for a disconnect in progress:
 * - the check runs first: the disconnect deletes the tokens afterwards, the new one included;
 * - the disconnect runs first: no consent is found, the pair's tokens are deleted and the token
 *   is refused.
 * Returns false when the token must not be handed out.
 */
export async function confirmStillConnected(
  pool: AuthDbPool,
  personId: string,
  clientId: string,
): Promise<boolean> {
  return inTransaction(pool, async (tx) => {
    const { rows } = await tx.query(
      'select 1 from as_oauth_consent where "userId" = $1 and "clientId" = $2 for share',
      [personId, clientId],
    );
    if (rows.length > 0) return true;
    await deletePair(tx, personId, clientId);
    return false;
  });
}
