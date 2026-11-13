import { describe, expect, it } from 'vitest';
import { QUEST_LIST_FILTERS } from '../constants';
import {
  applyProposalStatusesToOverview,
  isRejectedProposedQuest,
  questListBucket,
  questOverviewCounts,
} from '../proposal-list-status';
import type { QuestRecord, SpaceQuestsOverview } from '../types';

function quest(
  partial: Partial<QuestRecord> & Pick<QuestRecord, 'id' | 'status'>,
): QuestRecord {
  return {
    spaceId: 1,
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    slug: `quest-${partial.id}`,
    name: `Quest ${partial.id}`,
    goal: '',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    targetDate: null,
    leadPersonId: null,
    leadName: '',
    leadAvatarUrl: null,
    creatorPersonId: null,
    proposalDocumentId: null,
    proposalSlug: null,
    proposalWeb3Id: null,
    proposalStatus: null,
    acceptedAt: null,
    chatRoomId: null,
    health: {
      state: 'on_track',
      marker: 80,
      summary: '',
      updatesThisWeek: 0,
      lastUpdateAt: null,
      generatedAt: null,
      daysToTarget: null,
    },
    stewardHealthSummaries: false,
    memberUpdateAlerts: false,
    deliverablesEnabled: false,
    milestones: [],
    members: [],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

describe('rejected quest list status', () => {
  it('places Rejected after Completed in the status filter', () => {
    expect(QUEST_LIST_FILTERS).toEqual([
      'active',
      'proposed',
      'paused',
      'completed',
      'rejected',
    ]);
  });

  it('keeps a proposed quest under Proposed until its proposal is rejected', () => {
    const voting = quest({
      id: 1,
      status: 'proposed',
      proposalStatus: 'onVoting',
    });
    const unknown = quest({ id: 2, status: 'proposed', proposalStatus: null });
    expect(isRejectedProposedQuest(voting)).toBe(false);
    expect(isRejectedProposedQuest(unknown)).toBe(false);
    expect(questListBucket(voting)).toBe('proposed');
    expect(questListBucket(unknown)).toBe('proposed');
    expect(
      isRejectedProposedQuest({ status: 'active', proposalStatus: 'rejected' }),
    ).toBe(false);
  });

  it('moves a proposed quest to Rejected when the proposal status is rejected', () => {
    const rejected = quest({
      id: 3,
      status: 'proposed',
      proposalDocumentId: 11,
      proposalStatus: 'rejected',
    });
    expect(isRejectedProposedQuest(rejected)).toBe(true);
    expect(questListBucket(rejected)).toBe('rejected');
    expect(questListBucket(quest({ id: 4, status: 'completed' }))).toBe(
      'completed',
    );
    expect(questListBucket(quest({ id: 5, status: 'archived' }))).toBe(
      'archived',
    );
  });

  it('stamps proposal status from the outcome map and recounts Proposed without the rejected quests', () => {
    const overview: SpaceQuestsOverview = {
      spaceSlug: 'sandbox',
      spaceTitle: 'Sandbox',
      quests: [
        quest({ id: 1, status: 'proposed', proposalDocumentId: 10 }),
        quest({ id: 2, status: 'proposed', proposalDocumentId: 11 }),
        quest({ id: 3, status: 'proposed', proposalDocumentId: 13 }),
        quest({ id: 4, status: 'active', proposalDocumentId: 12 }),
        quest({ id: 5, status: 'completed' }),
        quest({ id: 6, status: 'archived' }),
      ],
      counts: questOverviewCounts([]),
    };

    const next = applyProposalStatusesToOverview(
      overview,
      new Map([
        [10, 'onVoting'],
        [11, 'rejected'],
        [12, 'accepted'],
      ]),
    );

    expect(next.quests.find((item) => item.id === 1)?.proposalStatus).toBe(
      'onVoting',
    );
    expect(next.quests.find((item) => item.id === 2)?.proposalStatus).toBe(
      'rejected',
    );
    expect(next.quests.find((item) => item.id === 3)?.proposalStatus).toBe(
      null,
    );
    expect(questListBucket(next.quests[0]!)).toBe('proposed');
    expect(questListBucket(next.quests[1]!)).toBe('rejected');
    expect(questListBucket(next.quests[2]!)).toBe('proposed');
    expect(next.counts).toEqual({
      active: 1,
      proposed: 2,
      paused: 0,
      completed: 1,
      rejected: 1,
      archived: 1,
      total: 5,
    });
  });
});
