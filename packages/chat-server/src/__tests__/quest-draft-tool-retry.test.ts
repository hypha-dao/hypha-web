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
import { assistSpaceQuestDraft } from '../quest-draft-assist';

type DraftTool = {
  execute: (patch: Record<string, unknown>) => Promise<unknown>;
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
  vi.spyOn(questServer, 'getSpaceQuestBySlug').mockResolvedValue(null);
  vi.spyOn(questServer, 'updateSpaceQuest').mockResolvedValue({
    ok: true,
    quest: null as never,
  });
});

describe('quest draft tool retry', () => {
  it('requires the tool once when a goal revision is prose only', async () => {
    const shorter =
      'Run one quest end-to-end in this sandbox, logging pass/fail notes per step.';
    const prose = [
      "Shorter version, same substance — it's a suggestion.",
      `"${shorter}"`,
      'Want to keep it this length, or name where those notes live before we move to scope?',
    ].join('\n\n');
    generateText.mockImplementation(
      async ({
        toolChoice,
        tools,
      }: {
        toolChoice?: { type: string; toolName: string };
        tools: { update_quest_draft: DraftTool };
      }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        await tools.update_quest_draft.execute({
          goal: shorter,
          scopeIn: ['should not stick'],
        });
        return { text: prose };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'make it shorter',
        currentStep: 'scope',
        pendingSuggestion: {
          status: 'revising',
          step: 'goal',
          wording:
            'The quest lead runs one quest end-to-end in this sandbox and logs pass/fail notes for each step.',
        },
      },
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.patch).toEqual({ goal: shorter });
    expect(result.reply).toMatch(/shorter version/i);
    expect(result.updatedQuest).toBeNull();
    expect(questServer.updateSpaceQuest).not.toHaveBeenCalled();
  });

  it('requires the tool once when a concrete scope proposal is prose only', async () => {
    const prose = [
      'In:',
      '• verify proposal display',
      '• verify milestone editing',
      'Out:',
      '• production rollout',
    ].join('\n');
    generateText.mockImplementation(
      async ({
        toolChoice,
        tools,
      }: {
        toolChoice?: { type: string; toolName: string };
        tools: { update_quest_draft: DraftTool };
      }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        await tools.update_quest_draft.execute({
          scopeIn: ['verify proposal display', 'verify milestone editing'],
          scopeOut: ['production rollout'],
          goal: 'should not stick',
        });
        return { text: prose };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message:
          'Propose a Scope for my confirmation: verify proposal display and milestone editing.',
        currentStep: 'scope',
      },
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.patch).toEqual({
      scopeIn: ['verify proposal display', 'verify milestone editing'],
      scopeOut: ['production rollout'],
    });
    expect(result.patch?.goal).toBeUndefined();
    expect(result.reply).toContain('verify proposal display');
  });

  it('requires the tool for the live scope proposals and their in/out reply', async () => {
    const attempt1 =
      'Propose a Scope for verifying proposal display, milestone editing and reward display in this sandbox; out of scope production rollout.';
    const attempt2 =
      'Propose a Scope for this quest: verify proposal display, verify milestone editing, verify reward display; out of scope production rollout.';
    const attempt3 = `${attempt1.slice(0, -1)} for my confirmation.`;
    const liveReply = [
      "Here's that scope as a suggestion",
      'In scope',
      '• Verify proposal display',
      '• Verify milestone editing',
      '• Verify reward display',
      'Out of scope',
      '• Production rollout',
      'Next: success criteria — what could a reviewer check to call each of these verified?',
    ].join('\n');
    const headingsOnly = [
      'In scope: verify proposal display, verify milestone editing, verify reward display',
      'Out of scope: production rollout',
      'Next: success criteria — what could a reviewer check to call each of these verified?',
    ].join('\n');
    generateText.mockImplementation(
      async ({
        toolChoice,
        tools,
      }: {
        toolChoice?: { type: string; toolName: string };
        tools: { update_quest_draft: DraftTool };
      }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        await tools.update_quest_draft.execute({
          scopeIn: [
            'Verify proposal display',
            'Verify milestone editing',
            'Verify reward display',
          ],
          scopeOut: ['Production rollout'],
          milestones: [{ name: 'should not stick' }],
        });
        return { text: headingsOnly };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: { message: attempt2, currentStep: 'goal' },
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.patch).toEqual({
      scopeIn: [
        'Verify proposal display',
        'Verify milestone editing',
        'Verify reward display',
      ],
      scopeOut: ['Production rollout'],
    });
    expect(result.reply).toBe(headingsOnly);
    expect(result.updatedQuest).toBeNull();
    expect(liveReply).toMatch(/In scope/);
    expect(attempt1).toMatch(/Propose a Scope/);
    expect(attempt3).toMatch(/for my confirmation/);
  });

  it('retries the live scope reply that asks whether to add more', async () => {
    const message =
      'Propose a Scope for this quest: verify proposal display, verify milestone editing, verify reward display; out of scope production rollout.';
    const liveReply = [
      "Here's the Scope suggestion",
      'In scope',
      '• Verify proposal display',
      '• Verify milestone editing',
      '• Verify reward display',
      'Out of scope',
      '• Production rollout',
      'One question: should anything about the lead flow itself (for example verifying who can claim or edit as lead) be in scope, or is it covered by the three items above?',
      'Nothing is waiting on a yes.',
    ].join('\n');
    generateText.mockImplementation(
      async ({
        toolChoice,
        tools,
      }: {
        toolChoice?: { type: string; toolName: string };
        tools: { update_quest_draft: DraftTool };
      }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        await tools.update_quest_draft.execute({
          scopeIn: [
            'Verify proposal display',
            'Verify milestone editing',
            'Verify reward display',
          ],
          scopeOut: ['Production rollout'],
          goal: 'should not stick',
        });
        return { text: liveReply };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: { message, currentStep: 'goal' },
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.patch).toEqual({
      scopeIn: [
        'Verify proposal display',
        'Verify milestone editing',
        'Verify reward display',
      ],
      scopeOut: ['Production rollout'],
    });
    expect(result.reply).toContain('One question: should anything');
    expect(result.updatedQuest).toBeNull();
  });

  it('requires the tool once for the live proposal messages and stays closed without a patch', async () => {
    const messages = [
      'Propose a Scope for verifying proposal display, milestone editing and reward display in this sandbox; out of scope production rollout.',
      'Propose a Scope for this quest: verify proposal display, verify milestone editing, verify reward display; out of scope production rollout.',
      'Propose a goal for my confirmation: the quest lead runs one quest end-to-end in this sandbox and logs a pass or fail for each step.',
      'I like the goal but make it shorter',
    ];
    for (const message of messages) {
      generateText.mockReset();
      generateText.mockImplementation(
        async ({ toolChoice }: { toolChoice?: unknown }) => {
          expect(toolChoice).toEqual({
            type: 'tool',
            toolName: 'update_quest_draft',
          });
          return {
            text: 'Nothing is waiting on a yes. Suggested above — confirm it and it saves to Scope.',
          };
        },
      );
      const result = await assistSpaceQuestDraft({
        spaceSlug: 'sandbox',
        input: { message, currentStep: 'goal' },
      });
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(result.patch).toBeNull();
      expect(result.updatedQuest).toBeNull();
    }
  });

  it('leaves the tool optional for a question or a chat aside, and stays closed when the required call sends no patch', async () => {
    generateText.mockImplementation(
      async ({ toolChoice }: { toolChoice?: unknown }) => {
        expect(toolChoice).toBeUndefined();
        return { text: 'It names an activity. Who should be able to tell?' };
      },
    );
    const question = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: { message: 'do you think that is well defined goal?' },
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(question.patch).toBeNull();

    generateText.mockReset();
    generateText.mockImplementation(
      async ({ toolChoice }: { toolChoice?: unknown }) => {
        expect(toolChoice).toBeUndefined();
        return { text: 'Lead scoring can wait.' };
      },
    );
    const aside = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'Add lead scoring',
        currentStep: 'scope',
        pendingSuggestion: {
          status: 'awaiting',
          step: 'scope',
          wording: 'In:\n• verify proposal display',
        },
      },
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(aside.patch).toBeNull();

    generateText.mockReset();
    generateText.mockImplementation(
      async ({ toolChoice }: { toolChoice?: unknown }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        return {
          text: "Shorter version — it's a suggestion, but I will not file it.",
        };
      },
    );
    const missed = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'make it shorter',
        pendingSuggestion: { status: 'revising', step: 'goal' },
      },
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(missed.patch).toBeNull();
    expect(missed.reply).toMatch(/shorter version/i);
  });

  it('coaches a saved quest from its draft and does not write it', async () => {
    generateText.mockImplementation(
      async ({
        toolChoice,
        prompt,
        tools,
      }: {
        toolChoice?: { type: string; toolName: string };
        prompt: string;
        tools: { update_quest_draft: DraftTool };
      }) => {
        expect(toolChoice).toEqual({
          type: 'tool',
          toolName: 'update_quest_draft',
        });
        expect(prompt).toContain('Keep the saved goal');
        await tools.update_quest_draft.execute({
          goal: 'Ship the onboarding checklist for new members.',
          scopeIn: ['should not stick'],
        });
        return { text: 'Suggested a shorter goal.' };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'make the goal shorter',
        currentStep: 'goal',
        draft: {
          name: 'Onboarding',
          goal: 'Keep the saved goal',
          scopeIn: ['docs'],
          scopeOut: [],
          successCriteria: '- members finish',
          targetDate: null,
          leadName: 'Ada Lovelace',
          rewards: [],
          milestones: [{ name: 'Draft', description: 'Notes' }],
          members: [],
        },
      },
    });

    expect(result.patch).toEqual({
      goal: 'Ship the onboarding checklist for new members.',
    });
    expect(result.updatedQuest).toBeNull();
    expect(questServer.updateSpaceQuest).not.toHaveBeenCalled();
    expect(questServer.getSpaceQuestBySlug).not.toHaveBeenCalled();
  });
});
