import { describe, expect, it } from 'vitest';
import {
  buildQuestProposalDescription,
  canMemberEditQuest,
  isViewerQuestLead,
  parseQuestProposalFromDescription,
  slugifyQuestName,
  stripQuestProposalMarker,
} from '../markdown';
import type { QuestDraftInput } from '../types';

const draft: QuestDraftInput = {
  name: 'Onboarding matcher',
  goal: 'Match every new joiner to 3 Spaces within their first day.',
  scopeIn: ['Interest survey', 'Matching from Space Context'],
  scopeOut: ['Paid placements'],
  successCriteria: '- 60% join a suggested Space in 7 days',
  rewards: [
    { amount: '2,500', token: 'USDC' },
    { amount: '0.4', token: 'ETH' },
    { amount: '', token: 'HYPHA' },
  ],
  targetDate: 'Jan 15, 2027',
  leadName: 'Vlad K. (you)',
  milestones: [
    {
      name: 'Survey + data',
      description: 'Survey live',
      dueDate: 'Nov 27',
      ownerName: 'Maria S.',
    },
  ],
  members: [
    {
      memberName: 'Maria S.',
      roleLabel: 'Member',
      responsibilities: ['Survey UX', ' '],
    },
  ],
};

describe('quest proposal description', () => {
  it('round-trips the structured quest behind a readable summary', () => {
    const description = buildQuestProposalDescription(
      draft,
      'onboarding-matcher',
    );
    expect(description.startsWith(draft.goal)).toBe(true);
    expect(stripQuestProposalMarker(description)).toBe(draft.goal);

    const parsed = parseQuestProposalFromDescription(description);
    expect(parsed?.questSlug).toBe('onboarding-matcher');
    expect(parsed?.scopeIn).toEqual(draft.scopeIn);
    expect(parsed?.rewards).toEqual([
      { amount: '2,500', token: 'USDC' },
      { amount: '0.4', token: 'ETH' },
    ]);
    expect(parsed?.milestones[0]).toMatchObject({
      order: 1,
      dueDate: 'Nov 27',
    });
    expect(parsed?.members[0]?.responsibilities).toEqual(['Survey UX']);
  });

  it('ignores descriptions without a quest marker', () => {
    expect(parseQuestProposalFromDescription('Plain proposal')).toBeNull();
    expect(parseQuestProposalFromDescription(null)).toBeNull();
  });

  it('slugifies quest names', () => {
    expect(slugifyQuestName('  Space Context MVP!  ')).toBe(
      'space-context-mvp',
    );
    expect(slugifyQuestName('***')).toBe('quest');
  });
});

describe('quest permissions', () => {
  const quest = {
    leadPersonId: 7,
    leadName: 'Vlad K.',
    status: 'active' as const,
    members: [
      {
        id: 1,
        questId: 1,
        personId: 9,
        memberName: 'Maria S.',
        memberAvatarUrl: null,
        roleLabel: 'Member',
        responsibilities: [],
        order: 0,
      },
    ],
  };

  it('lets the lead and quest members edit, and blocks everyone else', () => {
    expect(canMemberEditQuest({ id: 7 }, quest)).toBe(true);
    expect(canMemberEditQuest({ id: 9 }, quest)).toBe(true);
    expect(canMemberEditQuest({ id: 42, name: 'Someone Else' }, quest)).toBe(
      false,
    );
    expect(canMemberEditQuest(null, quest)).toBe(false);
    expect(
      canMemberEditQuest({ id: 7 }, { ...quest, status: 'archived' }),
    ).toBe(false);
  });

  it('only treats the lead as lead', () => {
    expect(isViewerQuestLead({ id: 7 }, quest)).toBe(true);
    expect(isViewerQuestLead({ id: 9 }, quest)).toBe(false);
  });
});
