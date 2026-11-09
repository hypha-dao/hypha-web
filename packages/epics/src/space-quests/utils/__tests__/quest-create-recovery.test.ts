import { describe, expect, it } from 'vitest';
import { StaleDeploymentError } from '@hypha-platform/core/client';
import {
  STALE_DEPLOYMENT_MESSAGE,
  questPublishFailurePlan,
} from '../quest-create-recovery';
import {
  questCreateSessionKey,
  readQuestCreateSession,
  writeQuestCreateSession,
} from '../quest-create-session';

const actionNotFound = new Error(
  'Server Action "60967ca92bbb299600c8c3651e2f62137cd7bf1011" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
);

describe('quest publish failure plan', () => {
  it('drops a quest created before the Web2 agreement action was found', () => {
    expect(questPublishFailurePlan(actionNotFound, 'quest-test')).toEqual({
      kind: 'stale',
      deleteQuestSlug: 'quest-test',
      keepAgreement: null,
    });
    expect(STALE_DEPLOYMENT_MESSAGE).toBe(
      'A new version of Hypha was deployed. Reload to continue. Your draft is kept.',
    );
  });

  it('keeps the agreement when the Web2 step already ran', () => {
    const error = new StaleDeploymentError({
      id: 44,
      slug: 'quest-test-proposal',
    });
    expect(questPublishFailurePlan(error, 'quest-test')).toEqual({
      kind: 'stale',
      deleteQuestSlug: null,
      keepAgreement: { id: 44, slug: 'quest-test-proposal' },
    });
  });

  it('does not treat a normal failure as a stale deploy', () => {
    expect(
      questPublishFailurePlan(
        new Error('Failed to create quest'),
        'quest-test',
      ),
    ).toEqual({ kind: 'other' });
  });
});

describe('quest create session', () => {
  it('keeps the draft, helper history, and agreement checkpoint', () => {
    const storage = new Map<string, string>();
    const memory = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    const key = questCreateSessionKey('myspace-stale-oa-20261027-1059');
    writeQuestCreateSession(memory, key, {
      draft: {
        name: 'Quest test',
        goal: 'Verify that the quest flow works end-to-end.',
        scopeIn: ['Create the quest in this sandbox'],
        scopeOut: [],
        scopeInMarkdown: '',
        scopeOutMarkdown: '',
        successCriteria: '',
        rewards: [],
        milestones: [],
        leadName: 'Vlad Hramtsov (you)',
        selectedLeadPersonId: 7,
        members: [],
        targetDate: '2026-01-01',
      },
      messages: [
        {
          id: 'm1',
          role: 'member',
          senderName: 'Quest Helper',
          text: 'Hey, what is the goal of the quest you want to create?',
          timestamp: new Date('2026-11-09T20:00:00.000Z'),
        },
        {
          id: 'u1',
          role: 'user',
          text: 'Ship the checklist',
          timestamp: new Date('2026-11-09T20:01:00.000Z'),
        },
      ],
      step: 2,
      pending: null,
      checkpoint: {
        questSlug: 'quest-test',
        agreementId: 44,
        agreementSlug: 'quest-test-proposal',
        proposalTitle: 'Quest test',
      },
    });
    const restored = readQuestCreateSession(memory, key);
    expect(restored?.draft.name).toBe('Quest test');
    expect(restored?.draft.goal).toContain('end-to-end');
    expect(restored?.draft.scopeIn).toEqual([
      'Create the quest in this sandbox',
    ]);
    expect(restored?.messages.map((message) => message.text)).toEqual([
      'Hey, what is the goal of the quest you want to create?',
      'Ship the checklist',
    ]);
    expect(restored?.checkpoint).toEqual({
      questSlug: 'quest-test',
      agreementId: 44,
      agreementSlug: 'quest-test-proposal',
      proposalTitle: 'Quest test',
    });
    expect(restored?.step).toBe(2);
  });
});
