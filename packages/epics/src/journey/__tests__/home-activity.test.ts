import { describe, expect, it } from 'vitest';
import {
  excerptText,
  isActiveSignalRecommendation,
  isActiveVoteRecommendation,
  isOpenForVote,
  isTaskRecommendation,
  selectAttentionItems,
  votesFromDocuments,
} from '../home-activity';

const space = { slug: 'garden', title: 'Garden' };
const now = new Date('2026-08-25T12:00:00.000Z');
const future = '2026-08-26T12:00:00.000Z';
const past = '2026-08-24T12:00:00.000Z';
const openOutcomes = {
  accepted: new Set<string>(),
  rejected: new Set<string>(),
  withdrawn: new Set<string>(),
};

describe('home-activity recommendations', () => {
  it('treats on-voting proposals as needing a vote', () => {
    expect(
      isOpenForVote(
        { state: 'proposal', status: 'onVoting', web3ProposalId: 11 },
        { now, liveness: { endTime: future } },
      ),
    ).toBe(true);
    expect(
      isOpenForVote({
        state: 'proposal',
        status: 'accepted',
        web3ProposalId: 11,
      }),
    ).toBe(false);
    expect(
      isOpenForVote({
        state: 'agreement',
        status: 'accepted',
        web3ProposalId: 11,
      }),
    ).toBe(false);
  });

  it('never recommends a bare DB proposal without on-chain proof it is still open', () => {
    expect(isActiveVoteRecommendation({ state: 'proposal' })).toBe(false);
    expect(
      isActiveVoteRecommendation({ state: 'proposal', web3ProposalId: 9 }),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', web3ProposalId: 9 },
        { outcomes: openOutcomes },
      ),
    ).toBe(false);
  });

  it('excludes closed, rejected, withdrawn, executed, expired, and ended votes', () => {
    expect(isActiveVoteRecommendation({ state: 'discussion' })).toBe(false);
    expect(isActiveVoteRecommendation({ state: 'memory' })).toBe(false);
    expect(isActiveVoteRecommendation({ state: 'agreement' })).toBe(false);
    expect(
      isActiveVoteRecommendation({
        state: 'proposal',
        status: 'rejected',
        web3ProposalId: 3,
      }),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', web3ProposalId: 3 },
        {
          now,
          outcomes: {
            accepted: new Set(['3']),
            rejected: new Set(),
            withdrawn: new Set(),
          },
          liveness: { endTime: future },
        },
      ),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', web3ProposalId: 4 },
        {
          now,
          outcomes: {
            accepted: new Set(),
            rejected: new Set(['4']),
            withdrawn: new Set(),
          },
          liveness: { endTime: future },
        },
      ),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', web3ProposalId: 5 },
        {
          now,
          outcomes: {
            accepted: new Set(),
            rejected: new Set(),
            withdrawn: new Set(['5']),
          },
          liveness: { endTime: future },
        },
      ),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', status: 'onVoting', web3ProposalId: 6 },
        { now, liveness: { executed: true, endTime: future } },
      ),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', status: 'onVoting', web3ProposalId: 7 },
        { now, liveness: { expired: true, endTime: future } },
      ),
    ).toBe(false);
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', status: 'onVoting', web3ProposalId: 8 },
        { now, liveness: { endTime: past } },
      ),
    ).toBe(false);
  });

  it('keeps a proposal that is still open on-chain and inside the voting window', () => {
    expect(
      isActiveVoteRecommendation(
        { state: 'proposal', web3ProposalId: 12 },
        {
          now,
          outcomes: openOutcomes,
          liveness: { endTime: future, executed: false, expired: false },
        },
      ),
    ).toBe(true);
  });

  it('maps only active open proposals onto vote items', () => {
    const items = votesFromDocuments(
      [
        {
          id: 1,
          title: 'Fund the kitchen',
          slug: 'proposal-1',
          state: 'proposal',
          status: 'onVoting',
          web3ProposalId: 101,
        } as never,
        {
          id: 2,
          title: 'Closed accepted',
          slug: 'proposal-2',
          state: 'proposal',
          status: 'accepted',
          web3ProposalId: 102,
        } as never,
        {
          id: 3,
          title: 'Bare leftover proposal',
          slug: 'proposal-3',
          state: 'proposal',
          web3ProposalId: 103,
        } as never,
        {
          id: 4,
          title: 'Discussion only',
          slug: 'discussion-3',
          state: 'discussion',
        } as never,
        {
          id: 5,
          title: 'Vote already ended',
          slug: 'proposal-5',
          state: 'proposal',
          status: 'onVoting',
          web3ProposalId: 105,
        } as never,
      ],
      space,
      {
        now,
        outcomes: openOutcomes,
        livenessByProposalId: new Map([
          [101, { endTime: future, executed: false, expired: false }],
          [105, { endTime: past, executed: false, expired: false }],
        ]),
      },
    );

    expect(items).toEqual([
      {
        id: 'garden:1',
        title: 'Fund the kitchen',
        spaceSlug: 'garden',
        spaceTitle: 'Garden',
        spaceLogoUrl: null,
        proposalSlug: 'proposal-1',
        documentId: 1,
        web3ProposalId: 101,
        web3SpaceId: null,
        description: null,
        happenedAt: 0,
        closesAt: new Date(future).getTime(),
      },
    ]);
  });

  it('prefers votes that close soon over newer votes that close later', () => {
    const soon = new Date('2026-08-28T13:00:00.000Z').getTime();
    const later = new Date('2026-08-31T12:00:00.000Z').getTime();
    const items = selectAttentionItems(
      [
        {
          id: 'later',
          kind: 'vote' as const,
          spaceSlug: 'honey',
          happenedAt: new Date('2026-08-28T11:00:00.000Z').getTime(),
          closesAt: later,
        },
        {
          id: 'soon',
          kind: 'vote' as const,
          spaceSlug: 'garden',
          happenedAt: new Date('2026-08-27T12:00:00.000Z').getTime(),
          closesAt: soon,
        },
      ],
      { now: new Date('2026-08-28T12:00:00.000Z'), limit: 2 },
    );

    expect(items[0]).toMatchObject({ id: 'soon' });
  });

  it('prefers open votes and mixes spaces instead of one stale batch', () => {
    const weekAgo = new Date('2026-08-01T12:00:00.000Z').getTime();
    const yesterday = new Date('2026-08-27T12:00:00.000Z').getTime();
    const items = selectAttentionItems(
      [
        {
          id: 'acaw:1',
          kind: 'signal' as const,
          spaceSlug: 'acaw',
          happenedAt: weekAgo,
        },
        {
          id: 'acaw:2',
          kind: 'signal' as const,
          spaceSlug: 'acaw',
          happenedAt: weekAgo,
        },
        {
          id: 'acaw:3',
          kind: 'signal' as const,
          spaceSlug: 'acaw',
          happenedAt: weekAgo,
        },
        {
          id: 'acaw:4',
          kind: 'signal' as const,
          spaceSlug: 'acaw',
          happenedAt: weekAgo,
        },
        {
          id: 'acaw:5',
          kind: 'signal' as const,
          spaceSlug: 'acaw',
          happenedAt: weekAgo,
        },
        {
          id: 'garden:9',
          kind: 'vote' as const,
          spaceSlug: 'garden',
          happenedAt: yesterday,
        },
        {
          id: 'honey:2',
          kind: 'signal' as const,
          spaceSlug: 'honey',
          happenedAt: yesterday,
        },
        {
          id: 'hypha:1',
          kind: 'signal' as const,
          spaceSlug: 'hypha',
          happenedAt: yesterday,
        },
      ],
      { now: new Date('2026-08-28T12:00:00.000Z'), limit: 5 },
    );

    expect(items[0]).toMatchObject({ id: 'garden:9', kind: 'vote' });
    expect(items.map((item) => item.spaceSlug)).toEqual(
      expect.arrayContaining(['garden', 'honey', 'hypha', 'acaw']),
    );
    expect(
      items.filter((item) => item.spaceSlug === 'acaw').length,
    ).toBeLessThanOrEqual(2);
  });

  it('maps pipeline and due-date signals to tasks, not backlog chatter', () => {
    expect(isTaskRecommendation({ progressStatus: 'backlog' })).toBe(false);
    expect(isTaskRecommendation({ progressStatus: 'todo' })).toBe(true);
    expect(isTaskRecommendation({ progressStatus: 'in_progress' })).toBe(true);
    expect(isTaskRecommendation({ dueAt: '2026-08-26T12:00:00.000Z' })).toBe(
      true,
    );
    expect(excerptText('<p>Hello  world</p>', 20)).toBe('Hello world');
  });

  it('hides archived and completed signals', () => {
    expect(isActiveSignalRecommendation({ archived: false })).toBe(true);
    expect(
      isActiveSignalRecommendation({
        archived: false,
        progressStatus: 'in_progress',
      }),
    ).toBe(true);
    expect(isActiveSignalRecommendation({ archived: true })).toBe(false);
    expect(
      isActiveSignalRecommendation({ archived: false, progressStatus: 'done' }),
    ).toBe(false);
    expect(
      isActiveSignalRecommendation({
        archived: false,
        progressStatus: 'cancelled',
      }),
    ).toBe(false);
    expect(
      isActiveSignalRecommendation({
        archived: false,
        progressStatus: 'completed',
      }),
    ).toBe(false);
  });
});
