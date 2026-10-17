import 'server-only';

import type { DbConfig } from '../../server';
import { verifyPrivyAuthToken } from '../../common/server/verify-privy-auth-token';
import { findPersonBySub } from '../../people/server/queries';
import { isOnChainMemberOrDelegate } from '../../space/server/is-on-chain-member-or-delegate';
import { isLevelSatisfied } from '../visibility-rule';
import { getSpaceLevels, relationsForSpaces } from './viewer-access';

type Person = NonNullable<Awaited<ReturnType<typeof findPersonBySub>>>;

export type V2Caller =
  | { kind: 'guest' }
  | { kind: 'user'; person: Person; address: `0x${string}` | null };

export type V2Failure = {
  ok: false;
  status: 401 | 403 | 500;
  error: string;
  message?: string;
};

/**
 * Resolve the optional user from `Authorization: Bearer`. The token is verified
 * with `verifyPrivyAuthToken` (not the Neon-RLS path v1 reads use). A token that
 * is present but invalid is a 401, never silently downgraded to a guest, so an
 * integrator sees a broken token instead of PUBLIC-only data.
 */
export async function resolveV2Caller(
  authorizationHeader: string | null | undefined,
  { db }: DbConfig,
): Promise<{ ok: true; caller: V2Caller } | V2Failure> {
  if (!authorizationHeader?.trim()) {
    return { ok: true, caller: { kind: 'guest' } };
  }
  const token = authorizationHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const auth = await verifyPrivyAuthToken(token);
  if (!auth.ok) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const person = await findPersonBySub({ sub: auth.userId }, { db });
  if (!person) {
    return { ok: false, status: 403, error: 'A Hypha profile is required' };
  }
  return {
    ok: true,
    caller: {
      kind: 'user',
      person,
      address: (person.address as `0x${string}` | null | undefined) ?? null,
    },
  };
}

const CHECK_FAILED: V2Failure = {
  ok: false,
  status: 500,
  error: 'Failed to verify access',
  message: 'An error occurred while checking your permissions.',
};

/**
 * The single v2 read gate (K13, K17), used by every space-scoped route. It
 * evaluates the space's on-chain `access` level with the same pure rule the
 * viewer-aware list uses for `discoverability` (`isLevelSatisfied`):
 *   PUBLIC        -> anyone with an approved client key (guests included)
 *   NETWORK       -> any verified Hypha user
 *   ORGANISATION  -> direct member/delegate, or member/delegate of a DB
 *                    organisation sibling, or a member of a member-space
 *                    (org-level: it can read, it is not "inside")
 *   SPACE         -> direct member, or delegate with a member delegator
 * Divergences from v1 / the Hypha UI: no Postgres `memberships` fallback; fails
 * CLOSED (500) when the level or the viewer's relation cannot be read; a
 * member-space participant is org-level (the UI treats it as space-level).
 * Levels and viewer facts come from a short-lived cache of chain facts.
 * A space with no `web3SpaceId` has no on-chain setting and is open, as in v1.
 */
export async function authorizeSpaceRead(
  space: { id: number; web3SpaceId: number | null | undefined },
  caller: V2Caller,
  { db }: DbConfig,
): Promise<{ ok: true } | V2Failure> {
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) return { ok: true };

  let level: number | undefined;
  try {
    level = (await getSpaceLevels([web3SpaceId])).get(web3SpaceId)?.access;
  } catch (error) {
    console.error('[api-v2] access level read failed', error);
    return CHECK_FAILED;
  }
  if (level === undefined) return CHECK_FAILED;

  if (level === 0) return { ok: true };

  if (caller.kind !== 'user') {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
      message: 'This space requires a verified user token.',
    };
  }
  const address = caller.address;
  if (!address) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid authentication',
      message: 'Could not verify your identity.',
    };
  }
  if (level === 1) return { ok: true };

  try {
    // Authoritative direct check first (a fresh joiner is not held back by the cache).
    const direct = await isOnChainMemberOrDelegate(web3SpaceId, address);
    if (direct) return { ok: true };

    const relations = await relationsForSpaces(
      caller,
      [web3SpaceId],
      () => level,
      { db },
    );
    const relation = relations.get(web3SpaceId);
    if (relation && isLevelSatisfied(level, relation)) return { ok: true };
  } catch (error) {
    console.error('[api-v2] membership read failed', error);
    return CHECK_FAILED;
  }

  return level === 2
    ? {
        ok: false,
        status: 403,
        error: 'Access denied',
        message:
          'You need to be a member of the organisation to access this space data.',
      }
    : {
        ok: false,
        status: 403,
        error: 'Access denied',
        message: 'You need to be a member of this space to access its data.',
      };
}
