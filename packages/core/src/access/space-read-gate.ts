import 'server-only';

import type { DbConfig } from '../server';
import { isOnChainMemberOrDelegate } from '../space/server/is-on-chain-member-or-delegate';
import type { Caller } from './caller';
import { failure, type Failure } from './failure';
import { isLevelSatisfied } from './visibility-rule';
import { getSpaceLevels, relationsForSpaces } from './viewer-access';

const CHECK_FAILED = failure(
  'access_check_failed',
  'An error occurred while checking your permissions.',
);

/**
 * The transparency matrix for ONE space (K13, K17): evaluates the space's on-chain
 * `access` level with the same pure rule the viewer-aware list uses for
 * `discoverability` (`isLevelSatisfied`):
 *   PUBLIC        -> anyone (guests included)
 *   NETWORK       -> any verified Hypha user
 *   ORGANISATION  -> direct member/delegate, or member/delegate of a DB
 *                    organisation sibling, or a member of a member-space
 *                    (org-level: it can read, it is not "inside")
 *   SPACE         -> direct member, or delegate with a member delegator
 * Divergences from v1 / the Hypha UI: no Postgres `memberships` fallback; fails
 * CLOSED when the level or the viewer's relation cannot be read; a member-space
 * participant is org-level (the UI treats it as space-level).
 * Levels and viewer facts come from a short-lived cache of chain facts.
 * A space with no `web3SpaceId` has no on-chain setting and is open, as in v1;
 * the access policy (`policy.ts`) closes that case for callers it applies to.
 *
 * Call it through the policy, not directly, unless you are the policy.
 */
export async function authorizeSpaceRead(
  space: { id: number; web3SpaceId: number | null | undefined },
  caller: Caller,
  { db }: DbConfig,
): Promise<{ ok: true } | Failure> {
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) return { ok: true };

  let level: number | undefined;
  try {
    level = (await getSpaceLevels([web3SpaceId])).get(web3SpaceId)?.access;
  } catch (error) {
    console.error('[access] access level read failed', error);
    return CHECK_FAILED;
  }
  if (level === undefined) return CHECK_FAILED;

  if (level === 0) return { ok: true };

  if (caller.kind !== 'user') {
    return failure(
      'unauthenticated',
      'This space requires a verified user token.',
    );
  }
  const address = caller.address;
  if (!address) {
    return failure('invalid_identity', 'Could not verify your identity.');
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
    console.error('[access] membership read failed', error);
    return CHECK_FAILED;
  }

  return failure(
    'forbidden',
    level === 2
      ? 'You need to be a member of the organisation to access this space data.'
      : 'You need to be a member of this space to access its data.',
  );
}
