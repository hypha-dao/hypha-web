import 'server-only';

import type { DbConfig } from '../../server';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import type { V2Caller, V2Failure } from './access';
import { readChainClock, readMemberAndDelegate } from './chain-reads';

export type MyMembershipV2 = {
  /** `null` = unknown (the space has no on-chain id), never `false`. */
  isMember: boolean | null;
  isDelegate: boolean | null;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * The caller's own relationship to a space. No content access gate: the
 * answer is about the caller, so a verified user who is not a member gets
 * `200 {isMember:false, isDelegate:false}`, not 403/404. A delegate who is not
 * a member is a valid state. Uses the same `readMemberAndDelegate` as `my-vote`
 * so the two cannot drift.
 */
export async function buildMyMembershipV2(
  { spaceSlug, caller }: { spaceSlug: string; caller: V2Caller },
  { db }: DbConfig,
): Promise<
  | { ok: true; body: MyMembershipV2 }
  | V2Failure
  | { ok: false; status: 404 | 502; error: string; message?: string }
> {
  if (caller.kind !== 'user') {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
      message: 'This route needs a verified user token.',
    };
  }
  if (!caller.address) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid authentication',
      message: 'Could not verify your identity.',
    };
  }

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, status: 404, error: 'Space not found' };

  if (typeof host.web3SpaceId !== 'number') {
    const clock = await readChainClock();
    return {
      ok: true,
      body: {
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
      body: {
        isMember: membership.isMember,
        isDelegate: membership.isDelegate,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
      },
    };
  } catch (error) {
    console.error('[api-v2] my-membership chain read failed', error);
    return {
      ok: false,
      status: 502,
      error: 'Chain read failed',
      message: 'Membership could not be read from the chain.',
    };
  }
}
