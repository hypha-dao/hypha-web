import 'server-only';

import type { DbConfig } from '../../server';
import {
  readChainClock,
  readIsProposalWithdrawn,
  readMemberAndDelegate,
  readProposalCoreBatch,
  readProposalVoters,
} from '../../access/chain-reads';
import type { Caller } from '../../access/caller';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess } from '../../access/policy';
import {
  decideCanVote,
  type CanVoteReason,
} from '../../access/proposal-status';
import { getMemberVotingPower } from '../../coherence/server/web3/get-member-voting-power';
import { findProposalVoteRefBySlug } from '../../governance/server/queries';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';

export type MyVote = {
  hasVoted: boolean;
  vote: 'yes' | 'no' | null;
  isMember: boolean;
  isDelegate: boolean;
  /** Current `getVotingPower` view as a decimal string (token decimals in `votingPowerDecimals`). */
  votingPower: string;
  votingPowerDecimals: number;
  /** The contract's source id: 1 token, 2 member, 3 voice. */
  votingPowerSource: number;
  /** Necessary conditions only, see `decideCanVote`. */
  canVote: boolean;
  reason: CanVoteReason;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * Feature function "get my vote": the caller's own vote on one proposal or agreement (quest
 * agreements included) and whether they can still vote. The access policy answers first, on
 * the space; the proposal must belong to that space. The voter lists are read to find the
 * caller's own vote and are never returned.
 */
export async function getMyVote(
  {
    spaceSlug,
    documentSlug,
    caller,
  }: { spaceSlug: string; documentSlug: string; caller: Caller },
  { db }: DbConfig,
): Promise<{ ok: true; data: MyVote } | Failure> {
  if (caller.kind !== 'user') {
    return failure('unauthenticated', 'A verified user is required.');
  }
  if (!caller.address) {
    return failure('invalid_identity', 'Could not verify your identity.');
  }
  const address = caller.address;

  try {
    const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
    if (!host) return failure('not_found', 'Space not found');

    const decision = await decideSpaceAccess(host, caller, { db });
    if (decision.outcome === 'none') {
      return decision.failure.code === 'access_check_failed'
        ? decision.failure
        : failure('not_found', 'Space not found');
    }

    const ref = await findProposalVoteRefBySlug(
      { spaceId: host.id, slug: documentSlug },
      { db },
    );
    if (
      !ref ||
      ref.web3ProposalId == null ||
      typeof host.web3SpaceId !== 'number'
    ) {
      return failure('not_found', 'Proposal not found');
    }
    const proposalId = Number(ref.web3ProposalId);
    const web3SpaceId = host.web3SpaceId;

    try {
      const [cores, withdrawn, voters, membership, power, clock] =
        await Promise.all([
          readProposalCoreBatch([proposalId]),
          readIsProposalWithdrawn(proposalId),
          readProposalVoters(proposalId),
          readMemberAndDelegate(web3SpaceId, address),
          getMemberVotingPower({ memberAddress: address, web3SpaceId }),
          readChainClock(),
        ]);
      const core = cores.get(proposalId);
      if (!core) throw new Error('proposal core read failed');

      const lower = address.toLowerCase();
      const yes = voters.yesVoters.some((v) => v.toLowerCase() === lower);
      const no = voters.noVoters.some((v) => v.toLowerCase() === lower);
      const verdict = decideCanVote({
        withdrawn,
        executed: core.executed,
        expired: core.expired,
        startTime: Number(core.startTime),
        endTime: Number(core.endTime),
        nowSeconds: clock.nowSeconds,
        isMember: membership.isMember,
        isDelegate: membership.isDelegate,
        votingPower: power.votingPower,
      });

      return {
        ok: true,
        data: {
          hasVoted: yes || no,
          vote: yes ? 'yes' : no ? 'no' : null,
          isMember: membership.isMember,
          isDelegate: membership.isDelegate,
          votingPower: power.votingPower.toString(),
          votingPowerDecimals: power.tokenDecimals,
          votingPowerSource: power.votingPowerSource,
          canVote: verdict.canVote,
          reason: verdict.reason,
          asOf: clock.asOf,
          asOfBlock: clock.asOfBlock,
        },
      };
    } catch (error) {
      console.error('[features] vote chain read failed', error);
      return failure(
        'chain_read_failed',
        'Vote state could not be read from the chain.',
      );
    }
  } catch (error) {
    console.error('[features] get my vote failed', error);
    return failure(
      'access_check_failed',
      'The vote could not be read right now.',
    );
  }
}
