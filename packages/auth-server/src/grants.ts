import type { AuthDbPool } from './db';

/**
 * Per-space grants (#2610 G2a). What a person lets one AI client read, stored per person and
 * client and put into the access token as the `space_grants` claim:
 * - `'all'`: everything the person can see, spaces joined later included;
 * - a list of database space ids (numbers): only those spaces, no sub-spaces, nothing joined later.
 * The resource side still intersects with the person's own rights, so a grant never gives more
 * than the person has. Database ids are not secrets.
 */
export const SPACE_GRANTS_CLAIM = 'space_grants';
/** Most spaces an explicit grant can name (keeps the token small). "All" has no limit. */
export const MAX_SPACE_GRANTS = 200;
/** The only level in this release. 'write' is reserved. */
export const GRANT_LEVEL_READ = 'read';

export type GrantValue = 'all' | number[];

export class GrantError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'unknown_space' | 'too_many_spaces',
  ) {
    super(code);
    this.name = 'GrantError';
  }
}

/**
 * Reads the consent body field. Strict: `"all"`, or a non-empty list of distinct positive
 * integers of at most {@link MAX_SPACE_GRANTS}. Anything else throws and nothing is stored.
 */
export function parseGrantInput(raw: unknown): GrantValue {
  if (raw === 'all') return 'all';
  if (!Array.isArray(raw) || raw.length === 0)
    throw new GrantError('invalid_request');
  if (raw.length > MAX_SPACE_GRANTS) throw new GrantError('too_many_spaces');
  const ids = new Set<number>();
  for (const id of raw) {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
      throw new GrantError('invalid_request');
    ids.add(id);
  }
  return [...ids];
}

/**
 * Validates a claim read from a verified token. Fail closed: anything that is not `"all"` or a
 * list of at most {@link MAX_SPACE_GRANTS} distinct positive safe integers is refused (null),
 * never widened. An empty list is valid and grants nothing.
 */
export function parseGrantClaim(raw: unknown): GrantValue | null {
  if (raw === 'all') return 'all';
  if (!Array.isArray(raw) || raw.length > MAX_SPACE_GRANTS) return null;
  const seen = new Set<number>();
  for (const id of raw) {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
      return null;
    if (seen.has(id)) return null;
    seen.add(id);
  }
  return [...seen];
}

type Snapshot = GrantValue | null;

/** What is stored now for the pair; null when there is no grant row. */
export async function readGrant(
  pool: Pick<AuthDbPool, 'query'>,
  personId: string,
  clientId: string,
): Promise<Snapshot> {
  const head = await pool.query<{ mode: string }>(
    'select mode from as_client_grant where "userId" = $1 and "clientId" = $2',
    [personId, clientId],
  );
  const mode = head.rows[0]?.mode;
  if (!mode) return null;
  if (mode === 'all') return 'all';
  const rows = await pool.query<{ spaceId: number }>(
    'select "spaceId" from as_client_grant_space where "userId" = $1 and "clientId" = $2 order by "spaceId"',
    [personId, clientId],
  );
  return rows.rows.map((r) => r.spaceId);
}

/**
 * The claim for a token: the stored grant, or an empty list when the pair has none (nothing is
 * granted; never "all"). Throws when a stored list is over the cap so no oversized claim is minted.
 */
export async function grantClaimFor(
  pool: Pick<AuthDbPool, 'query'>,
  personId: string,
  clientId: string,
): Promise<GrantValue> {
  const grant = await readGrant(pool, personId, clientId);
  if (grant === null) return [];
  if (grant !== 'all' && grant.length > MAX_SPACE_GRANTS)
    throw new GrantError('too_many_spaces');
  return grant;
}

/**
 * Replaces the stored grant for the pair inside a transaction the caller has opened (`tx` is a
 * connection in a transaction). `null` removes it.
 */
export async function replaceGrantIn(
  tx: Pick<AuthDbPool, 'query'>,
  personId: string,
  clientId: string,
  value: Snapshot,
): Promise<void> {
  await tx.query(
    'delete from as_client_grant where "userId" = $1 and "clientId" = $2',
    [personId, clientId],
  );
  if (value === null) return;
  await tx.query(
    `insert into as_client_grant ("userId", "clientId", mode, level) values ($1, $2, $3, $4)`,
    [personId, clientId, value === 'all' ? 'all' : 'spaces', GRANT_LEVEL_READ],
  );
  if (value !== 'all') {
    await tx.query(
      `insert into as_client_grant_space ("userId", "clientId", "spaceId", level)
       select $1, $2, s, $4 from unnest($3::int[]) as s`,
      [personId, clientId, value, GRANT_LEVEL_READ],
    );
  }
}

/** Replaces the stored grant for the pair in one transaction. `null` removes it. */
export async function writeGrant(
  pool: AuthDbPool,
  personId: string,
  clientId: string,
  value: Snapshot,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await replaceGrantIn(client, personId, clientId, value);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Where the consent page's space picker starts. A new connection (no stored grant) and a stored
 * "all" start on "All my spaces", as before. A stored list starts on "Only the spaces I choose"
 * with that list ticked, so an approval given without touching the picker never widens it:
 * - spaces the person can no longer pick (not in `pickerSpaceIds`) are left out: narrower only;
 * - when the person's spaces could not be loaded (`pickerSpaceIds` null), the stored list is kept
 *   as it is (`keptUnlisted`), because offering only "All my spaces" would widen it.
 */
export function initialSpaceChoice(
  current: GrantValue | null,
  pickerSpaceIds: readonly number[] | null,
): { mode: 'all' | 'spaces'; chosen: number[]; keptUnlisted: boolean } {
  if (current === null || current === 'all') {
    return {
      mode: 'all',
      chosen: (pickerSpaceIds ?? []).slice(0, MAX_SPACE_GRANTS),
      keptUnlisted: false,
    };
  }
  if (pickerSpaceIds === null) {
    return {
      mode: 'spaces',
      chosen: current.slice(0, MAX_SPACE_GRANTS),
      keptUnlisted: true,
    };
  }
  const pickable = new Set(pickerSpaceIds);
  return {
    mode: 'spaces',
    chosen: current.filter((id) => pickable.has(id)).slice(0, MAX_SPACE_GRANTS),
    keptUnlisted: false,
  };
}

/** Every listed space must exist; a grant for an unknown id is refused. */
export async function assertSpacesExist(
  pool: Pick<AuthDbPool, 'query'>,
  ids: number[],
): Promise<void> {
  const { rows } = await pool.query<{ n: number }>(
    'select count(*)::int as n from spaces where id = any($1::int[])',
    [ids],
  );
  if ((rows[0]?.n ?? 0) !== ids.length) throw new GrantError('unknown_space');
}
