import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_INCLUDE_BLOCKS,
  SPACE_INCLUDE_BLOCKS,
  SPACES_LIST_INCLUDE_BLOCKS,
  parseInclude,
} from '../include';
import {
  buildProposalTally,
  decideCanVote,
  deriveProposalListStatus,
} from '../proposal-status';

describe('parseInclude', () => {
  it('returns an empty set when absent', () => {
    const r = parseInclude(null, SPACE_INCLUDE_BLOCKS);
    expect(r.ok && r.blocks.size).toBe(0);
  });

  it('parses comma-separated names with whitespace', () => {
    const r = parseInclude('visibility, counts', SPACE_INCLUDE_BLOCKS);
    expect(r.ok && [...r.blocks].sort()).toEqual(['counts', 'visibility']);
  });

  it('rejects unknown names and include=all', () => {
    const r = parseInclude('visibility,all,nope', SPACE_INCLUDE_BLOCKS);
    expect(r).toMatchObject({ ok: false, unknown: ['all', 'nope'] });
  });

  it('is per route: counts is not on the list, tally only on documents', () => {
    expect(parseInclude('counts', SPACES_LIST_INCLUDE_BLOCKS).ok).toBe(false);
    expect(parseInclude('tally', SPACE_INCLUDE_BLOCKS).ok).toBe(false);
    expect(parseInclude('tally', DOCUMENT_INCLUDE_BLOCKS).ok).toBe(true);
  });
});

describe('deriveProposalListStatus', () => {
  const sets = {
    accepted: new Set([1]),
    rejected: new Set([2, 4]),
    withdrawn: new Set([4]),
  };

  it('has no status without a web3ProposalId', () => {
    expect(deriveProposalListStatus(null, sets)).toBeUndefined();
    expect(deriveProposalListStatus(undefined, sets)).toBeUndefined();
  });

  it('maps the outcome sets', () => {
    expect(deriveProposalListStatus(1, sets)).toBe('accepted');
    expect(deriveProposalListStatus(2, sets)).toBe('rejected');
    expect(deriveProposalListStatus(3, sets)).toBe('onVoting');
  });

  it('withdrawn takes precedence over rejected', () => {
    expect(deriveProposalListStatus(4, sets)).toBe('withdrawn');
  });
});

describe('buildProposalTally', () => {
  const core = {
    startTime: 100n,
    endTime: 200n,
    executed: false,
    expired: false,
    yesVotes: 6n,
    noVotes: 2n,
    totalVotingPowerAtSnapshot: 20n,
  };
  const space = { quorum: 40n, unity: 70n };

  it('computes quorum and unity progress with the contract rules', () => {
    const t = buildProposalTally(core, space, 150);
    expect(t.yesVotes).toBe('6');
    expect(t.quorum).toEqual({
      requiredPercent: 40,
      requiredVotes: '8',
      progressPercent: 40,
      reached: true,
    });
    expect(t.unity).toEqual({
      requiredPercent: 70,
      progressPercent: 75,
      reached: true,
    });
    expect(t.awaitingDecision).toBe(false);
  });

  it('rounds the required votes up', () => {
    const t = buildProposalTally(
      { ...core, totalVotingPowerAtSnapshot: 21n },
      space,
      150,
    );
    expect(t.quorum.requiredVotes).toBe('9');
    expect(t.quorum.reached).toBe(false);
  });

  it('is awaitingDecision only when closed, not executed, not expired', () => {
    expect(buildProposalTally(core, space, 201).awaitingDecision).toBe(true);
    expect(buildProposalTally(core, space, 200).awaitingDecision).toBe(false);
    expect(
      buildProposalTally({ ...core, executed: true }, space, 201)
        .awaitingDecision,
    ).toBe(false);
    expect(
      buildProposalTally({ ...core, expired: true }, space, 201)
        .awaitingDecision,
    ).toBe(false);
  });

  it('handles zero snapshot and no votes without dividing by zero', () => {
    const t = buildProposalTally(
      {
        ...core,
        yesVotes: 0n,
        noVotes: 0n,
        totalVotingPowerAtSnapshot: 0n,
      },
      space,
      150,
    );
    expect(t.quorum.progressPercent).toBe(0);
    expect(t.quorum.reached).toBe(false);
    expect(t.unity.progressPercent).toBe(0);
    expect(t.unity.reached).toBe(false);
  });

  it('leaves requirements null when the space settings are unknown', () => {
    const t = buildProposalTally(core, null, 150);
    expect(t.quorum.requiredPercent).toBeNull();
    expect(t.quorum.reached).toBeNull();
    expect(t.unity.reached).toBeNull();
  });
});

describe('decideCanVote', () => {
  const open = {
    withdrawn: false,
    executed: false,
    expired: false,
    startTime: 100,
    endTime: 200,
    nowSeconds: 150,
    isMember: true,
    isDelegate: false,
    votingPower: 1n,
  };

  it('is eligible when all necessary conditions hold', () => {
    expect(decideCanVote(open)).toEqual({ canVote: true, reason: 'eligible' });
  });

  it('reports the first failing condition', () => {
    expect(decideCanVote({ ...open, withdrawn: true }).reason).toBe(
      'proposal_withdrawn',
    );
    expect(decideCanVote({ ...open, expired: true }).reason).toBe(
      'proposal_closed',
    );
    expect(decideCanVote({ ...open, executed: true }).reason).toBe(
      'proposal_closed',
    );
    expect(decideCanVote({ ...open, nowSeconds: 50 }).reason).toBe(
      'voting_not_started',
    );
    expect(decideCanVote({ ...open, nowSeconds: 201 }).reason).toBe(
      'voting_ended',
    );
    expect(decideCanVote({ ...open, isMember: false }).reason).toBe(
      'not_member_or_delegate',
    );
    expect(decideCanVote({ ...open, votingPower: 0n }).reason).toBe(
      'no_voting_power',
    );
  });

  it('accepts a delegate who is not a member', () => {
    expect(
      decideCanVote({ ...open, isMember: false, isDelegate: true }).canVote,
    ).toBe(true);
  });
});
