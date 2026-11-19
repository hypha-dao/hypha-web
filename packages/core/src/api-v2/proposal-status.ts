/**
 * Pure proposal-status, tally and eligibility rules for `/api/v2`.
 * No I/O: callers pass chain values in. Contract rules mirrored from
 * `DAOProposalsImplementation.checkAndExecuteProposal`:
 *   quorum reached when yes+no >= ceil(quorum * snapshot / 100)
 *   accepted when yes*100 >= unity*(yes+no)
 */

/**
 * Route-local on purpose: the shared `DocumentStatus` and the MCP output enum
 * are NOT widened with `withdrawn` (K14).
 */
export type ProposalListStatus =
  | 'onVoting'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type ProposalOutcomeIds = {
  accepted: ReadonlySet<number>;
  rejected: ReadonlySet<number>;
  withdrawn: ReadonlySet<number>;
};

/**
 * Withdrawn takes precedence over rejected (an owner-withdraw also lands in the
 * rejected list on chain). No "expired" status: the contract marks every
 * unaccepted closure `expired`, so timeout and vote-rejection are both
 * `rejected`. `onVoting` includes proposals past `endTime` whose outcome has
 * not been recorded yet (see `awaitingDecision` in the tally block).
 */
export function deriveProposalListStatus(
  web3ProposalId: number | null | undefined,
  outcomes: ProposalOutcomeIds,
): ProposalListStatus | undefined {
  if (web3ProposalId == null) return undefined;
  const pid = Number(web3ProposalId);
  if (outcomes.withdrawn.has(pid)) return 'withdrawn';
  if (outcomes.accepted.has(pid)) return 'accepted';
  if (outcomes.rejected.has(pid)) return 'rejected';
  return 'onVoting';
}

/** Raw `getProposalCore` fields the rules need (no `transactions[]`). */
export type ProposalCoreValues = {
  startTime: bigint;
  endTime: bigint;
  executed: boolean;
  expired: boolean;
  yesVotes: bigint;
  noVotes: bigint;
  totalVotingPowerAtSnapshot: bigint;
};

export type ProposalTally = {
  /** Unix seconds. */
  startTime: number;
  /** Unix seconds. */
  endTime: number;
  executed: boolean;
  /**
   * Contract name kept on purpose. Means "closed unaccepted" (vote rejection,
   * timeout or withdrawal), NOT "timed out".
   */
  expired: boolean;
  /** uint256 as decimal strings. */
  yesVotes: string;
  noVotes: string;
  totalVotingPowerAtSnapshot: string;
  quorum: {
    /** Space's current quorum percent (setting can change after creation). */
    requiredPercent: number | null;
    /** ceil(requiredPercent * snapshot / 100), decimal string; null if unknown. */
    requiredVotes: string | null;
    /** (yes+no) / snapshot * 100; 0 when the snapshot is 0. */
    progressPercent: number;
    reached: boolean | null;
  };
  unity: {
    /** Space's current unity percent. */
    requiredPercent: number | null;
    /** yes / (yes+no) * 100; 0 when nobody voted. */
    progressPercent: number;
    reached: boolean | null;
  };
  /**
   * `now > endTime && !executed && !expired`: closed, outcome not yet recorded
   * on chain. Not "undecided". The detail banner's duration/quorum/unity
   * guard is a UI stale-read guard and is NOT part of this flag.
   */
  awaitingDecision: boolean;
};

function percent(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0;
  // 4 decimals of precision without floating-point on big values.
  return Number((numerator * 1_000_000n) / denominator) / 10_000;
}

export function buildProposalTally(
  core: ProposalCoreValues,
  space: { quorum: bigint; unity: bigint } | null,
  nowSeconds: number,
): ProposalTally {
  const total = core.yesVotes + core.noVotes;
  const snapshot = core.totalVotingPowerAtSnapshot;

  let quorumRequiredVotes: bigint | null = null;
  let quorumReached: boolean | null = null;
  let unityReached: boolean | null = null;
  if (space) {
    quorumRequiredVotes = (space.quorum * snapshot + 99n) / 100n;
    quorumReached = snapshot > 0n && total >= quorumRequiredVotes;
    unityReached = total > 0n && core.yesVotes * 100n >= space.unity * total;
  }

  return {
    startTime: Number(core.startTime),
    endTime: Number(core.endTime),
    executed: core.executed,
    expired: core.expired,
    yesVotes: core.yesVotes.toString(),
    noVotes: core.noVotes.toString(),
    totalVotingPowerAtSnapshot: snapshot.toString(),
    quorum: {
      requiredPercent: space ? Number(space.quorum) : null,
      requiredVotes:
        quorumRequiredVotes === null ? null : quorumRequiredVotes.toString(),
      progressPercent: percent(total, snapshot),
      reached: quorumReached,
    },
    unity: {
      requiredPercent: space ? Number(space.unity) : null,
      progressPercent: percent(core.yesVotes, total),
      reached: unityReached,
    },
    awaitingDecision:
      nowSeconds > Number(core.endTime) && !core.executed && !core.expired,
  };
}

export type CanVoteReason =
  | 'eligible'
  | 'proposal_withdrawn'
  | 'proposal_closed'
  | 'voting_not_started'
  | 'voting_ended'
  | 'not_member_or_delegate'
  | 'no_voting_power';

/**
 * NECESSARY conditions only: open window, member-or-delegate, power > 0. The
 * contract also requires an active space subscription (unless the proposal
 * targets the Hypha token), so `true` is not a guarantee a vote will succeed.
 * Re-voting is allowed, so `hasVoted` is not a blocker. First failing
 * condition wins.
 */
export function decideCanVote(input: {
  withdrawn: boolean;
  executed: boolean;
  expired: boolean;
  startTime: number;
  endTime: number;
  nowSeconds: number;
  isMember: boolean;
  isDelegate: boolean;
  votingPower: bigint;
}): { canVote: boolean; reason: CanVoteReason } {
  const fail = (reason: CanVoteReason) => ({ canVote: false, reason });
  if (input.withdrawn) return fail('proposal_withdrawn');
  if (input.executed || input.expired) return fail('proposal_closed');
  if (input.nowSeconds < input.startTime) return fail('voting_not_started');
  if (input.nowSeconds > input.endTime) return fail('voting_ended');
  if (!input.isMember && !input.isDelegate) {
    return fail('not_member_or_delegate');
  }
  if (input.votingPower <= 0n) return fail('no_voting_power');
  return { canVote: true, reason: 'eligible' };
}
