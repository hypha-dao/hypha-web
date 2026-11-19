import 'server-only';

import type { DbConfig } from '../../server';
import {
  readChainClock,
  readMemberAndDelegate,
} from '../../access/chain-reads';
import type { Caller } from '../../access/caller';
import { failure, type Failure } from '../../access/failure';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';

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
  { spaceSlug, caller }: { spaceSlug: string; caller: Caller },
  { db }: DbConfig,
): Promise<{ ok: true; data: MyMembership } | Failure> {
  if (caller.kind !== 'user') {
    return failure('unauthenticated', 'A verified user is required.');
  }
  if (!caller.address) {
    return failure('invalid_identity', 'Could not verify your identity.');
  }

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return failure('not_found', 'Space not found');

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
