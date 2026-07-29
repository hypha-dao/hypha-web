import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({
  after: vi.fn((callback: () => unknown) => {
    void callback();
  }),
}));
vi.mock('../server/web3/get-member-voting-power', () => ({
  getMemberVotingPower: vi.fn(),
}));
vi.mock('../server/web3/record-signal-upvote-onchain', () => ({
  recordSignalUpvoteOnChain: vi.fn(),
}));
vi.mock('../server/coherence-upvotes', () => ({
  EMPTY_COHERENCE_UPVOTE_SUMMARY: {
    totalVotingPower: '0',
    upvoteCount: 0,
    tokenDecimals: 0,
    voters: [],
    myUpvote: null,
  },
  findCoherenceUpvoteSummaries: vi.fn().mockResolvedValue({}),
  removeCoherenceUpvote: vi.fn(),
  upsertCoherenceUpvote: vi.fn(),
}));

import { after } from 'next/server';

import {
  applyCoherenceUpvote,
  applyCoherenceUpvoteRemoval,
  resolveVotingPowerPercent,
  type CoherenceUpvoteTarget,
} from '../server/apply-coherence-upvote';
import {
  removeCoherenceUpvote,
  upsertCoherenceUpvote,
} from '../server/coherence-upvotes';
import { getMemberVotingPower } from '../server/web3/get-member-voting-power';
import { recordSignalUpvoteOnChain } from '../server/web3/record-signal-upvote-onchain';

const db = {} as never;
const voter = '0x1111111111111111111111111111111111111111';

const signal: CoherenceUpvoteTarget = {
  id: 11,
  spaceId: 5,
  archived: false,
  web3SpaceId: 77,
};

const actor = { id: 3, address: voter };

const mockedAfter = vi.mocked(after);
const mockedVotingPower = vi.mocked(getMemberVotingPower);
const mockedUpsert = vi.mocked(upsertCoherenceUpvote);
const mockedRemove = vi.mocked(removeCoherenceUpvote);
const mockedMirror = vi.mocked(recordSignalUpvoteOnChain);

beforeEach(() => {
  vi.clearAllMocks();
  mockedVotingPower.mockResolvedValue({
    votingPower: 1000n,
    votingPowerSource: 1,
    tokenDecimals: 18,
  });
});

describe('resolveVotingPowerPercent', () => {
  it('defaults to the full 100% when missing or unparseable', () => {
    expect(resolveVotingPowerPercent(undefined)).toBe(100);
    expect(resolveVotingPowerPercent('not a number')).toBe(100);
  });

  it('clamps into 1..100 and truncates fractions', () => {
    expect(resolveVotingPowerPercent(0)).toBe(1);
    expect(resolveVotingPowerPercent(-20)).toBe(1);
    expect(resolveVotingPowerPercent(250)).toBe(100);
    expect(resolveVotingPowerPercent(42.9)).toBe(42);
  });
});

describe('applyCoherenceUpvote', () => {
  it('snapshots a share of the on-chain voting power', async () => {
    await applyCoherenceUpvote(
      { coherence: signal, actor, votingPowerPercent: 25 },
      { db },
    );

    expect(mockedVotingPower).toHaveBeenCalledWith({
      memberAddress: voter,
      web3SpaceId: 77,
    });
    expect(mockedUpsert).toHaveBeenCalledWith(
      {
        coherenceId: 11,
        personId: 3,
        votingPower: '250',
        maxVotingPower: '1000',
        tokenDecimals: 18,
      },
      { db },
    );
  });

  it('allocates at least one unit when the percentage rounds to zero', async () => {
    mockedVotingPower.mockResolvedValue({
      votingPower: 10n,
      votingPowerSource: 2,
      tokenDecimals: 0,
    });

    await applyCoherenceUpvote(
      { coherence: signal, actor, votingPowerPercent: 1 },
      { db },
    );

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ votingPower: '1' }),
      { db },
    );
  });

  it('mirrors the upvote on-chain with the snapshotted amount', async () => {
    await applyCoherenceUpvote({ coherence: signal, actor }, { db });

    expect(mockedMirror).toHaveBeenCalledWith({
      web3SpaceId: 77,
      signalId: 11,
      voter,
      amount: 1000n,
      kind: 'upvote',
    });
  });

  it('still mirrors when `after` is unavailable outside a request scope', async () => {
    mockedAfter.mockImplementationOnce(() => {
      throw new Error('after() was called outside a request scope');
    });

    await applyCoherenceUpvote({ coherence: signal, actor }, { db });

    expect(mockedMirror).toHaveBeenCalledWith({
      web3SpaceId: 77,
      signalId: 11,
      voter,
      amount: 1000n,
      kind: 'upvote',
    });
  });

  it('refuses to vote on an archived signal', async () => {
    await expect(
      applyCoherenceUpvote(
        { coherence: { ...signal, archived: true }, actor },
        { db },
      ),
    ).rejects.toThrow('Cannot vote on an archived signal');
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('refuses when the space has no on-chain id', async () => {
    await expect(
      applyCoherenceUpvote(
        { coherence: { ...signal, web3SpaceId: null }, actor },
        { db },
      ),
    ).rejects.toThrow('not linked to an on-chain space');
  });

  it('refuses when the actor has no linked wallet', async () => {
    await expect(
      applyCoherenceUpvote(
        { coherence: signal, actor: { id: 3, address: null } },
        { db },
      ),
    ).rejects.toThrow('A linked wallet is required');
  });

  it('refuses when the actor holds no voting power in the space', async () => {
    mockedVotingPower.mockResolvedValue({
      votingPower: 0n,
      votingPowerSource: 1,
      tokenDecimals: 18,
    });

    await expect(
      applyCoherenceUpvote({ coherence: signal, actor }, { db }),
    ).rejects.toThrow('no voting power');
    expect(mockedUpsert).not.toHaveBeenCalled();
  });
});

describe('applyCoherenceUpvoteRemoval', () => {
  it('mirrors a removal when a row was actually deleted', async () => {
    mockedRemove.mockResolvedValue(true);

    await applyCoherenceUpvoteRemoval({ coherence: signal, actor }, { db });

    expect(mockedMirror).toHaveBeenCalledWith({
      web3SpaceId: 77,
      signalId: 11,
      voter,
      kind: 'removal',
    });
  });

  it('stays silent on-chain when there was nothing to remove', async () => {
    mockedRemove.mockResolvedValue(false);

    await applyCoherenceUpvoteRemoval({ coherence: signal, actor }, { db });

    expect(mockedMirror).not.toHaveBeenCalled();
  });
});
