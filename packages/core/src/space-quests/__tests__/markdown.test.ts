import { describe, expect, it } from 'vitest';
import {
  buildQuestProposalDescription,
  canMemberEditQuest,
  embeddedQuestProposalMatchesQuest,
  isViewerQuestLead,
  mergeRefinedQuestMembers,
  mergeRefinedQuestMilestones,
  parseQuestProposalFromDescription,
  questRecordToProposalDraft,
  slugifyQuestName,
  stripQuestProposalMarker,
  stripViewerYouMarker,
  withoutPlaceholderLeadDuplicates,
  type EmbeddedQuestProposalPayload,
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

  it('matches a proposal only when every term matches the quest', () => {
    const slug = 'onboarding-matcher';
    const description = buildQuestProposalDescription(draft, slug);
    const parsed = parseQuestProposalFromDescription(description);
    const quest = {
      slug,
      name: draft.name.trim(),
      goal: draft.goal.trim(),
      scopeIn: draft.scopeIn,
      scopeOut: draft.scopeOut,
      scopeInMarkdown: '',
      scopeOutMarkdown: '',
      successCriteria: draft.successCriteria.trim(),
      rewards: draft.rewards.filter(
        (reward) => reward.amount.trim() && reward.token.trim(),
      ),
      targetDate: draft.targetDate,
      leadName: draft.leadName.trim(),
      milestones: draft.milestones.map((milestone, index) => ({
        order: index + 1,
        name: milestone.name.trim(),
        description: milestone.description.trim(),
        dueDate: milestone.dueDate?.trim() || null,
        ownerName: milestone.ownerName?.trim() || null,
      })),
      members: draft.members.map((member, index) => ({
        order: index + 1,
        memberName: member.memberName.trim(),
        roleLabel: member.roleLabel ?? null,
        responsibilities: member.responsibilities
          .map((item) => item.trim())
          .filter(Boolean),
      })),
    };

    expect(parsed && embeddedQuestProposalMatchesQuest(parsed, quest)).toBe(
      true,
    );
    expect(
      parsed &&
        embeddedQuestProposalMatchesQuest(parsed, {
          ...quest,
          goal: 'A different goal',
        }),
    ).toBe(false);
    expect(
      parsed &&
        embeddedQuestProposalMatchesQuest(parsed, {
          ...quest,
          slug: 'same-terms-other-slug',
        }),
    ).toBe(false);
    expect(
      parsed &&
        embeddedQuestProposalMatchesQuest(
          {
            ...(parsed as EmbeddedQuestProposalPayload),
            questSlug: slug,
            goal: 'Changed after the quest was saved',
          },
          quest,
        ),
    ).toBe(false);
    expect(
      embeddedQuestProposalMatchesQuest(
        { name: draft.name } as EmbeddedQuestProposalPayload,
        quest,
      ),
    ).toBe(false);
  });

  it('keeps a lone placeholder lead and drops the invented duties', () => {
    const members = withoutPlaceholderLeadDuplicates([
      {
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery', 'Unblock reviews'],
      },
    ]);
    expect(members).toEqual([
      {
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead',
        responsibilities: [],
      },
    ]);
  });

  it('drops a placeholder lead when that person already has a real assignment', () => {
    const members = withoutPlaceholderLeadDuplicates([
      {
        personId: 7,
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery', 'Unblock reviews'],
      },
      {
        personId: 7,
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead / QA runner',
        responsibilities: [
          'Run the create flow for tip 397c602e9 and own the numbered evidence set (E1-E9)',
          'Own the final PASS/FAIL checklist and the go/no-go call for this tip',
        ],
      },
      {
        personId: 8,
        memberName: 'Grok Test',
        roleLabel: 'Writer',
        responsibilities: ['Write the notes'],
      },
    ]);
    expect(members.map((member) => member.roleLabel)).toEqual([
      'Lead / QA runner',
      'Writer',
    ]);
  });

  it('does not collapse two people who share a display name', () => {
    const members = withoutPlaceholderLeadDuplicates([
      {
        personId: 7,
        memberName: 'Alex',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery', 'Unblock reviews'],
      },
      {
        personId: 8,
        memberName: 'Alex',
        roleLabel: 'Writer',
        responsibilities: ['Write the notes'],
      },
    ]);
    expect(members.map((member) => member.personId)).toEqual([7, 8]);
    expect(members[0]?.responsibilities).toEqual([]);
    expect(members[1]?.responsibilities).toEqual(['Write the notes']);
  });

  it('uses the display name when a row has no person id', () => {
    const members = withoutPlaceholderLeadDuplicates([
      {
        memberName: 'Alex',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery'],
      },
      {
        personId: 8,
        memberName: 'Alex',
        roleLabel: 'Writer',
        responsibilities: ['Write the notes'],
      },
    ]);
    expect(members.map((member) => member.roleLabel)).toEqual(['Writer']);
  });

  it('keeps milestone progress and member ids when a refine matches by name', () => {
    const milestones = mergeRefinedQuestMilestones(
      [
        {
          id: 4,
          name: 'Inspect lists',
          description: 'Capture the roster',
          dueDate: '2026-11-06',
          ownerName: 'Vlad Hramtsov',
          ownerPersonId: 7,
          status: 'in_progress',
        },
      ],
      [
        {
          name: 'Inspect lists',
          description: 'Capture the roster again',
          ownerName: 'Vlad Hramtsov',
        },
      ],
      () => 99,
    );
    expect(milestones).toEqual([
      {
        id: 4,
        name: 'Inspect lists',
        description: 'Capture the roster again',
        dueDate: '2026-11-06',
        ownerName: 'Vlad Hramtsov',
        ownerPersonId: 7,
        status: 'in_progress',
      },
    ]);

    const members = mergeRefinedQuestMembers(
      [
        {
          id: 3,
          personId: 7,
          memberName: 'Vlad Hramtsov',
          roleLabel: 'Lead / QA runner',
          responsibilities: ['Own the checklist'],
        },
        {
          id: 9,
          personId: 8,
          memberName: 'Grok Test',
          roleLabel: 'Writer',
          responsibilities: ['Write the notes'],
        },
      ],
      [
        {
          memberName: 'Vlad Hramtsov',
          responsibilities: ['Own the checklist', 'Flag mismatches'],
        },
      ],
      (name) => (name === 'New Person' ? 11 : null),
    );
    expect(members.map((member) => member.personId)).toEqual([7, 8]);
    expect(members[0]).toMatchObject({
      id: 3,
      roleLabel: 'Lead / QA runner',
      responsibilities: ['Own the checklist', 'Flag mismatches'],
    });
    expect(members[1]?.id).toBe(9);
  });

  it('drops a lead row whose duties are only a subset of the placeholders', () => {
    const members = withoutPlaceholderLeadDuplicates([
      {
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery'],
      },
      {
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead / QA runner',
        responsibilities: ['Check the roster'],
      },
    ]);
    expect(members).toEqual([
      {
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead / QA runner',
        responsibilities: ['Check the roster'],
      },
    ]);
  });

  it('matches a proposal built from the saved quest', () => {
    const slug = 'onboarding-matcher';
    const quest = {
      slug,
      name: draft.name.trim(),
      goal: draft.goal.trim(),
      scopeIn: draft.scopeIn,
      scopeOut: draft.scopeOut,
      scopeInMarkdown: '',
      scopeOutMarkdown: '',
      successCriteria: draft.successCriteria.trim(),
      rewards: draft.rewards.filter(
        (reward) => reward.amount.trim() && reward.token.trim(),
      ),
      targetDate: draft.targetDate,
      leadName: draft.leadName.trim(),
      milestones: draft.milestones.map((milestone, index) => ({
        order: index + 1,
        name: milestone.name.trim(),
        description: milestone.description.trim(),
        dueDate: milestone.dueDate?.trim() || null,
        ownerName: milestone.ownerName?.trim() || null,
      })),
      members: draft.members.map((member, index) => ({
        order: index + 1,
        memberName: member.memberName.trim(),
        roleLabel: member.roleLabel ?? null,
        responsibilities: member.responsibilities
          .map((item) => item.trim())
          .filter(Boolean),
      })),
    };
    const description = buildQuestProposalDescription(
      questRecordToProposalDraft(quest),
      slug,
    );
    const parsed = parseQuestProposalFromDescription(description);
    expect(parsed && embeddedQuestProposalMatchesQuest(parsed, quest)).toBe(
      true,
    );
  });

  it('slugifies quest names', () => {
    expect(slugifyQuestName('  Space Context MVP!  ')).toBe(
      'space-context-mvp',
    );
    expect(slugifyQuestName('***')).toBe('quest');
    expect(slugifyQuestName('Hello---World')).toBe('hello-world');
    expect(
      slugifyQuestName(`${'-'.repeat(400)}Space Context${'-'.repeat(400)}`),
    ).toBe('space-context');
    expect(slugifyQuestName(`${'a'.repeat(80)}`)).toBe('a'.repeat(44));
  });

  it('strips a viewer you-marker without a backtracking regex', () => {
    expect(stripViewerYouMarker('Vlad K. (you)')).toBe('Vlad K.');
    expect(stripViewerYouMarker(`Vlad K.${' '.repeat(80)}(YOU)`)).toBe(
      'Vlad K.',
    );
    expect(stripViewerYouMarker('Maria S.')).toBe('Maria S.');
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

  it('requires a verified person id and never authorizes by display name', () => {
    const unresolved = {
      ...quest,
      leadPersonId: null,
      leadName: 'Vlad K.',
      members: [
        {
          ...quest.members[0]!,
          personId: null,
          memberName: 'Maria S.',
        },
      ],
    };
    expect(canMemberEditQuest({ id: 42, name: 'Vlad K.' }, unresolved)).toBe(
      false,
    );
    expect(canMemberEditQuest({ id: 42, name: 'Maria S.' }, unresolved)).toBe(
      false,
    );
    expect(isViewerQuestLead({ id: 42, name: 'Vlad K.' }, unresolved)).toBe(
      false,
    );
    expect(canMemberEditQuest({ name: 'Vlad K.' }, unresolved)).toBe(false);
    expect(isViewerQuestLead({ name: 'Vlad K.' }, unresolved)).toBe(false);
    expect(canMemberEditQuest({ id: 42, name: 'Vlad K.' }, quest)).toBe(false);
    expect(canMemberEditQuest({ id: 42, name: 'Maria S.' }, quest)).toBe(false);
    expect(isViewerQuestLead({ id: 42, name: 'Vlad K.' }, quest)).toBe(false);
  });
});
