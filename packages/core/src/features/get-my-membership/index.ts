import 'server-only';

import type { ReadCtx } from '../../data-access/types';
import { findSpaceHostFieldsBySlug } from '../../data-access/spaces';
import {
  readChainClock,
  readMemberAndDelegate,
} from '../../access/chain-reads';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess } from '../../access/policy';

export type MyMembership = {
  /** `null` = unknown (the space has no on-chain id), never `false`. */
  isMember: boolean | null;
  isDelegate: boolean | null;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * Feature function "get my membership": the caller's own relationship to a space. The
 * answer is about the caller, so a verified user who is not a member gets
 * `{isMember:false, isDelegate:false}`, not a refusal. A delegate who is not a member is a
 * valid state. Uses the same `readMemberAndDelegate` as the vote read so the two cannot drift.
 */
export async function getMyMembership(
  { spaceSlug }: { spaceSlug: string },
  ctx: ReadCtx,
): Promise<{ ok: true; data: MyMembership } | Failure> {
  const caller = ctx.actor;
  if (caller.kind !== 'user') {
    return failure('unauthenticated', 'A verified user is required.');
  }
  if (!caller.address) {
    return failure('invalid_identity', 'Could not verify your identity.');
  }

  const host = await findSpaceHostFieldsBySlug(ctx, { slug: spaceSlug });
  if (!host) return failure('not_found', 'Space not found');

  // Grants and the on-chain id rule always apply to a grant-aware caller; the transparency
  // matrix applies to it too (the API keeps its no-gate answer about the caller).
  const decision = await decideSpaceAccess(host, ctx, {
    matrix: caller.via !== undefined,
  });
  if (decision.outcome === 'none') {
    return decision.failure.code === 'access_check_failed'
      ? decision.failure
      : failure('not_found', 'Space not found');
  }

  if (typeof host.web3SpaceId !== 'number') {
    const clock = await readChainClock();
    return {
      ok: true,
      data: {
        isMember: null,
        isDelegate: null,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
      },
    };
  }

  try {
    const [membership, clock] = await Promise.all([
      readMemberAndDelegate(host.web3SpaceId, caller.address),
      readChainClock(),
    ]);
    return {
      ok: true,
      data: {
        isMember: membership.isMember,
        isDelegate: membership.isDelegate,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
      },
    };
  } catch (error) {
    console.error('[features] membership chain read failed', error);
    return failure(
      'chain_read_failed',
      'Membership could not be read from the chain.',
    );
  }
}
