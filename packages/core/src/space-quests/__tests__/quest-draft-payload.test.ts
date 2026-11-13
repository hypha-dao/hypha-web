import { describe, expect, it } from 'vitest';
import {
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
});
