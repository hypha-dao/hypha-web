import 'server-only';

import type { ReadCtx } from '../data-access/types';
import { readMemberAndDelegate } from './chain-reads';
import { failure, type Failure } from './failure';
import { decideSpaceAccess, hasScope } from './policy';

type SpaceRef = { id: number; web3SpaceId: number | null | undefined };

/** The chain read is injectable so the rule can be tested without a chain. */
export type WriteAccessDeps = {
  readMembership?: typeof readMemberAndDelegate;
};

/**
 * The write rule for a caller that arrived through the authorization server (#2744). A write
 * needs ALL of the following, checked in this order; the first that fails decides:
 *
 *   1. the token carries the write `scope` (fail closed: a caller without `via` holds none);
 *   2. the person granted this client the space explicitly or through "all spaces". Unlike the
 *      read path's grant check, a caller without `via` is refused here;
 *   3. the read rule (`decideSpaceAccess`): the space has an on-chain id and the caller may see it;
 *   4. the person is a member or a delegate of the space ON CHAIN, the same rule the app uses to
 *      let a person act in a space. The database membership table is not used: it is not kept
 *      up to date.
 *
 * A space the caller may not see is `not_found`, so existence never leaks. A visible space the
 * caller does not belong to is `forbidden`, with a message the person can act on.
 */
export async function decideSpaceWrite(
  space: SpaceRef,
  ctx: ReadCtx,
  { scope }: { scope: string },
  { readMembership = readMemberAndDelegate }: WriteAccessDeps = {},
): Promise<{ ok: true } | Failure> {
  const caller = ctx.actor;
  if (caller.kind !== 'user' || !caller.via) {
    return failure('unauthenticated', 'A verified user is required.');
  }
  if (!hasScope(caller, scope)) {
    return failure('forbidden', 'This app was not allowed to write.');
  }
  const grants = caller.via.spaceGrants;
  if (grants !== null && !grants.includes(space.id)) {
    return failure('not_found', 'Space not found');
  }

  const read = await decideSpaceAccess(space, ctx);
  if (read.outcome === 'none') {
    return read.failure.code === 'access_check_failed'
      ? read.failure
      : failure('not_found', 'Space not found');
  }

  // `decideSpaceAccess` already refuses a grant-aware caller a space with no on-chain id; kept
  // explicit so this rule never depends on that detail.
  if (typeof space.web3SpaceId !== 'number') {
    return failure('not_found', 'Space not found');
  }
  if (!caller.address) {
    return failure('invalid_identity', 'Could not verify your identity.');
  }

  let membership: { isMember: boolean; isDelegate: boolean };
  try {
    membership = await readMembership(space.web3SpaceId, caller.address);
  } catch (error) {
    console.error('[access] write membership chain read failed', {
      spaceId: space.id,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return failure(
      'access_check_failed',
      'Membership could not be read from the chain.',
    );
  }
  if (!membership.isMember && !membership.isDelegate) {
    return failure(
      'forbidden',
      'Only members and delegates of this space can do this.',
    );
  }
  return { ok: true };
}
