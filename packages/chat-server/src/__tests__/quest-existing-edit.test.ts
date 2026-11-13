import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  stepCountIs: () => ({}),
  tool: (definition: unknown) => definition,
}));

vi.mock('../stream-chat', () => ({
  getHyphaChatModel: () => 'mock-model',
}));

import * as questServer from '@hypha-platform/core/server';
import {
  QUEST_EDIT_NOT_SAVED_REPLY,
  assistSpaceQuestDraft,
} from '../quest-draft-assist';

const existingQuest = {
  slug: 'onboarding',
  name: 'Onboarding',
  status: 'active' as const,
  goal: 'Keep the saved goal',
  scopeIn: [] as string[],
  scopeOut: [] as string[],
  successCriteria: '',
  targetDate: null,
  leadName: 'Ada Lovelace',
  leadPersonId: 4,
  rewards: [],
  milestones: [],
  members: [],
  deliverables: [],
};

beforeEach(() => {
  generateText.mockReset();
  process.env.OPENROUTER_API_KEY = 'test-key';
  vi.spyOn(questServer, 'findSpaceBySlug').mockResolvedValue(null);
  vi.spyOn(questServer, 'listSpaceContextSections').mockResolvedValue(
    null as never,
  );
  vi.spyOn(questServer, 'computeSpaceMemberEntries').mockResolvedValue({
    found: true,
    entries: [],
  } as never);
  vi.spyOn(questServer, 'getSpaceQuestBySlug').mockResolvedValue(
    existingQuest as never,
  );
  vi.spyOn(questServer, 'updateSpaceQuest').mockResolvedValue({
    ok: true,
    quest: existingQuest as never,
  });
});

describe('existing quest edit boundary', () => {
  it('does not claim a save when the tool patch is dropped', async () => {
    generateText.mockImplementation(
      async ({
        tools,
      }: {
        tools: {
          update_quest_draft: {
            execute: (patch: Record<string, unknown>) => Promise<unknown>;
          };
        };
      }) => {
        await tools.update_quest_draft.execute({
          goal: 'A replaced goal',
          scopeIn: ['invented'],
        });
        return { text: 'Saved the goal.' };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      actor: { id: 4, name: 'Ada Lovelace' },
      input: {
        message: 'improve the goal',
        questSlug: 'onboarding',
        currentStep: 'goal',
      },
    });

    expect(questServer.updateSpaceQuest).not.toHaveBeenCalled();
    expect(result.patch).toBeNull();
    expect(result.updatedQuest).toBeNull();
    expect(result.reply).toBe(QUEST_EDIT_NOT_SAVED_REPLY);
    expect(result.reply).not.toMatch(/saved the goal/i);
  });

  it('saves only the commanded section when the quoted text looks like a bulk draft', async () => {
    generateText.mockImplementation(
      async ({
        tools,
      }: {
        tools: {
          update_quest_draft: {
            execute: (patch: Record<string, unknown>) => Promise<unknown>;
          };
        };
      }) => {
        await tools.update_quest_draft.execute({
          scopeIn: ['write all onboarding docs'],
          goal: 'hijacked goal',
          milestones: [{ name: 'Write everything' }],
        });
        return { text: 'Saved.' };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      actor: { id: 4, name: 'Ada Lovelace' },
      input: {
        message: 'Set the scope to "write all onboarding docs"',
        questSlug: 'onboarding',
        currentStep: 'goal',
      },
    });

    expect(questServer.updateSpaceQuest).toHaveBeenCalledTimes(1);
    const written = vi.mocked(questServer.updateSpaceQuest).mock.calls[0]?.[0];
    expect(written?.patch.scopeIn).toEqual(['write all onboarding docs']);
    expect(written?.patch.goal).toBeUndefined();
    expect(written?.patch.milestones).toBeUndefined();
    expect(written?.patch.successCriteria).toBeUndefined();
    expect(result.reply).toBe('Saved.');
    expect(result.patch).toEqual({
      scopeIn: ['write all onboarding docs'],
    });
    expect(result.updatedQuest).toEqual(existingQuest);
  });
});
