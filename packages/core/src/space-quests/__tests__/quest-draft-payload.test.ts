import { describe, expect, it } from 'vitest';
import { parseCreateAgreementWeb2 } from '../../governance/parse-create-agreement-web2';
import {
  QUEST_DOCUMENT_LABEL,
  QUEST_GOAL_LIMIT,
  QUEST_PROPOSAL_DESCRIPTION_LIMIT,
} from '../constants';
import { buildQuestProposalDescription } from '../markdown';
import {
  schemaCreateSpaceQuest,
  schemaQuestCreateDraftPayload,
  schemaSaveQuestDraft,
} from '../validation';

const payload = {
  draft: {
    name: 'Checklist',
    goal: 'Ship the checklist',
    scopeIn: ['Write the list'],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [{ amount: '', token: '' }],
    milestones: [
      {
        name: 'First cut',
        description: '',
        ownerName: 'Vlad',
        status: 'not_started',
      },
    ],
    leadName: 'Vlad',
    selectedLeadPersonId: 7,
    members: [],
    targetDate: null,
  },
  messages: [
    {
      id: 'm1',
      role: 'member',
      text: 'What is the goal?',
      timestamp: '2026-11-09T20:00:00.000Z',
      senderName: 'Quest Helper',
      agentSpecialistId: 'quest-helper',
    },
    {
      id: 'u1',
      role: 'user',
      text: 'Ship it',
      timestamp: '2026-11-09T20:01:00.000Z',
    },
  ],
  step: 1,
  pending: null,
};

describe('quest create draft payload', () => {
  it('accepts an unfinished draft, including an empty reward token', () => {
    const parsed = schemaQuestCreateDraftPayload.parse(payload);
    expect(parsed.draft.name).toBe('Checklist');
    expect(parsed.draft.rewards).toEqual([{ amount: '', token: '' }]);
    expect(parsed.messages).toHaveLength(2);
    expect(schemaSaveQuestDraft.parse({ id: 4, payload }).id).toBe(4);
  });

  it('rejects a draft that is not a private create-quest snapshot', () => {
    expect(
      schemaQuestCreateDraftPayload.safeParse({
        ...payload,
        pending: { step: 'not-a-step', patch: {} },
      }).success,
    ).toBe(false);
    expect(schemaSaveQuestDraft.safeParse({ id: 0, payload }).success).toBe(
      false,
    );
  });

  it('saves and publishes a 16000 character goal', () => {
    const sentence =
      'This is a long sandbox test paragraph for the quest proposal length limit, written to exceed four thousand characters comfortably. ';
    let goal = '';
    let section = 1;
    while (goal.length < 16_000) {
      goal += `Section ${section}. ${sentence}${sentence}${sentence}\n\n`;
      section += 1;
    }
    goal = goal.slice(0, 16_000);

    const longDraft = {
      ...payload,
      draft: {
        ...payload.draft,
        name: 'Long quest limit test 2662',
        goal,
        scopeIn: [],
        scopeOut: [],
        scopeInMarkdown: '',
        scopeOutMarkdown: '',
        successCriteria: '',
        leadName: 'Vlad Hramtsov',
        selectedLeadPersonId: 1,
        members: [],
      },
    };
    expect(schemaQuestCreateDraftPayload.parse(longDraft).draft.goal).toBe(
      goal,
    );
    expect(
      schemaSaveQuestDraft.parse({ payload: longDraft }).payload.draft.goal,
    ).toHaveLength(16_000);
    expect(
      schemaCreateSpaceQuest.parse({
        name: 'Long quest limit test 2662',
        goal,
        leadName: 'Vlad Hramtsov',
        leadPersonId: 1,
      }).goal,
    ).toBe(goal);

    const description = buildQuestProposalDescription(
      {
        name: 'Long quest limit test 2662',
        goal,
        scopeIn: [],
        scopeOut: [],
        successCriteria: '',
        rewards: [],
        targetDate: null,
        leadName: 'Vlad Hramtsov',
        milestones: [],
        members: [
          {
            memberName: 'Vlad Hramtsov',
            roleLabel: 'Lead',
            responsibilities: ['Overall delivery', 'Unblock reviews'],
          },
        ],
      },
      'q'.repeat(52),
    );
    expect(description.length).toBeGreaterThan(20_000);
    expect(description.length).toBeLessThanOrEqual(
      QUEST_PROPOSAL_DESCRIPTION_LIMIT,
    );
    expect(
      parseCreateAgreementWeb2({
        title: 'Long quest limit test 2662',
        description,
        creatorId: 1,
        spaceId: 1,
        label: QUEST_DOCUMENT_LABEL,
      }).description,
    ).toBe(description);

    const fullGoal = goal.repeat(2).slice(0, QUEST_GOAL_LIMIT);
    expect(fullGoal).toHaveLength(QUEST_GOAL_LIMIT);
    expect(
      schemaCreateSpaceQuest.safeParse({
        name: 'Long quest limit test 2662',
        goal: fullGoal,
        scopeIn: ['Map the integration layers', 'Sandbox testing'],
        scopeOut: ['Building infrastructure'],
        successCriteria: 'The written recommendation is delivered.',
        leadName: 'Vlad Hramtsov',
        leadPersonId: 1,
        members: [
          {
            memberName: 'Vlad Hramtsov',
            roleLabel: 'Lead',
            responsibilities: ['Overall delivery', 'Unblock reviews'],
          },
          {
            memberName: 'Alex Prate',
            roleLabel: 'Reviewer',
            responsibilities: ['Review the recommendation'],
          },
        ],
      }).success,
    ).toBe(true);
    const fullDescription = buildQuestProposalDescription(
      {
        name: 'Long quest limit test 2662',
        goal: fullGoal,
        scopeIn: ['Map the integration layers', 'Sandbox testing'],
        scopeOut: ['Building infrastructure'],
        successCriteria: 'The written recommendation is delivered.',
        rewards: [],
        targetDate: '16 November 2026',
        leadName: 'Vlad Hramtsov',
        milestones: [],
        members: [
          {
            memberName: 'Vlad Hramtsov',
            roleLabel: 'Lead',
            responsibilities: ['Overall delivery', 'Unblock reviews'],
          },
          {
            memberName: 'Alex Prate',
            roleLabel: 'Reviewer',
            responsibilities: ['Review the recommendation'],
          },
        ],
      },
      'q'.repeat(52),
    );
    expect(fullDescription.length).toBeLessThanOrEqual(
      QUEST_PROPOSAL_DESCRIPTION_LIMIT,
    );
  });
});
