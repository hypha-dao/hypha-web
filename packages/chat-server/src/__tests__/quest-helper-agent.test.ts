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
import {
  buildQuestHelperAgentPrompt,
  buildQuestHelperAgentSystem,
  createQuestHelperAgentTools,
  questPatchIsGrounded,
  type QuestHelperAgentState,
} from '../quest-helper-agent';

type AgentTools = Record<
  'suggest_section' | 'save_section' | 'discard_suggestion',
  { execute: (input: Record<string, unknown>) => Promise<unknown> }
>;

const scopePatch = {
  scopeIn: [
    'Defining one Quest in this space end to end',
    'Publishing that Quest as an Agreements proposal',
    'Confirming the proposal renders and confirms without errors',
  ],
  scopeOut: [
    'Fixing anything the test surfaces',
    'Testing Quests in other spaces',
    'Doing real work beyond this test',
  ],
};

function agentState(
  overrides: Partial<QuestHelperAgentState> = {},
): QuestHelperAgentState {
  return {
    pending: null,
    shownText: '',
    suggestion: null,
    saved: null,
    discarded: false,
    ...overrides,
  };
}

function tools(state: QuestHelperAgentState): AgentTools {
  return createQuestHelperAgentTools(state) as unknown as AgentTools;
}

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

describe('quest helper agent tools', () => {
  it('saves the waiting card for its section and nothing else', async () => {
    const state = agentState({ pending: { step: 'scope', patch: scopePatch } });
    const t = tools(state);

    expect(await t.save_section.execute({ section: 'goal' })).toMatchObject({
      ok: false,
    });
    expect(state.saved).toBeNull();

    expect(await t.save_section.execute({ section: 'scope' })).toMatchObject({
      ok: true,
    });
    expect(state.saved).toEqual({
      step: 'scope',
      patch: scopePatch,
      source: 'pending',
    });

    expect(await t.save_section.execute({ section: 'success' })).toMatchObject({
      ok: false,
    });
    expect(state.saved?.step).toBe('scope');
  });

  it('refuses to save a suggestion the member has not seen yet', async () => {
    const state = agentState();
    const t = tools(state);
    await t.suggest_section.execute({
      section: 'goal',
      fields: { goal: 'Ship the sandbox checklist.', scopeIn: ['drop me'] },
    });
    expect(state.suggestion).toEqual({
      step: 'goal',
      patch: { goal: 'Ship the sandbox checklist.' },
    });
    expect(await t.save_section.execute({ section: 'goal' })).toMatchObject({
      ok: false,
    });
    expect(state.saved).toBeNull();
  });

  it('saves wording shown earlier in prose, but not invented wording', async () => {
    const shownText =
      'In: defining one Quest here end to end, publishing it as an Agreements proposal, and confirming it renders and confirms without errors. Out: fixing anything the test surfaces, testing Quests in other spaces, and doing real work beyond this test.\n\nadd your suggestions to scope';
    const state = agentState({ shownText });
    const t = tools(state);

    expect(
      await t.save_section.execute({
        section: 'scope',
        fields: { scopeIn: ['Paying the quest reward in USDC'] },
      }),
    ).toMatchObject({ ok: false });
    expect(state.saved).toBeNull();

    expect(
      await t.save_section.execute({ section: 'scope', fields: scopePatch }),
    ).toMatchObject({ ok: true });
    expect(state.saved).toEqual({
      step: 'scope',
      patch: scopePatch,
      source: 'shown',
    });
  });

  it('records a rejected card', async () => {
    const state = agentState({ pending: { step: 'scope', patch: scopePatch } });
    await tools(state).discard_suggestion.execute({});
    expect(state.discarded).toBe(true);
  });

  it('grounds lightly reworded lines and rejects new facts', () => {
    const shown = 'Out: fixing anything the test surfaces.';
    expect(
      questPatchIsGrounded(
        { scopeOut: ['Fixing anything the test surfaces'] },
        shown,
      ),
    ).toBe(true);
    expect(
      questPatchIsGrounded({ targetDate: '30 November 2026' }, shown),
    ).toBe(false);
    expect(questPatchIsGrounded({}, shown)).toBe(false);
  });
});

describe('quest helper agent prompt', () => {
  it('teaches intent-based approval and marks member data as untrusted', () => {
    const system = buildQuestHelperAgentSystem({
      spaceTitle: 'Sandbox',
      spaceSlug: 'sandbox',
      spaceDescription: 'Open access test bed',
      contextDigest: '',
      rosterNames: 'Vlad Hramtsov',
      sandbox: true,
      savedQuest: false,
    });
    expect(system).toContain('yes I want you to add that');
    expect(system).toContain('add that to scope');
    expect(system).toMatch(/never leave finished wording only in prose/i);
    expect(system).toMatch(/Never say a section is saved/);
    expect(system).toContain('BEGIN UNTRUSTED DATA (space roster)');

    const saved = buildQuestHelperAgentSystem({
      spaceTitle: 'Sandbox',
      spaceSlug: 'sandbox',
      spaceDescription: '',
      contextDigest: '',
      rosterNames: '',
      sandbox: false,
      savedQuest: true,
    });
    expect(saved).toContain('This quest is already saved');

    const prompt = buildQuestHelperAgentPrompt({
      draftJson: JSON.stringify({ goal: 'Confirm quests work end to end.' }),
      historyLines: 'Quest Helper: In: … Out: …',
      currentStep: 'scope',
      pending: { step: 'scope', patch: scopePatch },
      pendingWording: 'In:\n- Defining one Quest',
      message: 'yes I want you to add that to scope',
    });
    expect(prompt.startsWith('Waiting suggestion card: Scope.')).toBe(true);
    expect(prompt).toContain('save_section("scope")');
    expect(prompt).toContain('BEGIN UNTRUSTED DATA (member message)');
    expect(
      buildQuestHelperAgentPrompt({
        draftJson: '{}',
        historyLines: '',
        currentStep: 'goal',
        pending: null,
        pendingWording: '',
        message: 'yes',
      }),
    ).toContain('Waiting suggestion card: none.');
  });
});

describe('assistSpaceQuestDraft with the quest helper agent', () => {
  it('lets the agent save the waiting Scope card on "yes I want you to add that to scope"', async () => {
    generateText.mockImplementation(
      async ({
        toolChoice,
        prompt,
        tools: agentTools,
      }: {
        toolChoice?: unknown;
        prompt: string;
        tools: AgentTools;
      }) => {
        expect(toolChoice).toBeUndefined();
        expect(prompt).toContain('Waiting suggestion card: Scope.');
        await agentTools.save_section.execute({ section: 'scope' });
        return {
          text: 'Next is Success criteria: what could a reviewer check to call this done?',
        };
      },
    );

    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'yes I want you to add that to scope',
        currentStep: 'scope',
        history: [
          {
            role: 'assistant',
            text: 'Not saved yet. Do you want that in Scope?',
          },
        ],
        pendingSuggestion: {
          status: 'awaiting',
          step: 'scope',
          wording: 'In: …',
          patch: scopePatch,
        },
      },
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.helper?.saved).toEqual({
      step: 'scope',
      patch: scopePatch,
      source: 'pending',
    });
    expect(result.helper?.suggestion).toBeNull();
    expect(result.reply).toMatch(/Success criteria/);
    expect(questServer.updateSpaceQuest).not.toHaveBeenCalled();
  });

  it('sends a plain yes to the agent and returns its suggestion as the card', async () => {
    generateText.mockImplementation(
      async ({ tools: agentTools }: { tools: AgentTools }) => {
        await agentTools.suggest_section.execute({
          section: 'goal',
          fields: { goal: 'Confirm quests work end to end in this sandbox.' },
        });
        return { text: 'Here is a goal with a checkable outcome.' };
      },
    );
    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: { message: 'suggest me a goal', currentStep: 'goal' },
    });
    expect(result.patch).toEqual({
      goal: 'Confirm quests work end to end in this sandbox.',
    });
    expect(result.helper?.suggestion?.step).toBe('goal');
    expect(result.helper?.saved).toBeNull();
  });

  it('ignores a malformed waiting card instead of failing the request', async () => {
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      expect(prompt).toContain('Waiting suggestion card: none.');
      return { text: 'What should be in scope?' };
    });
    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: {
        message: 'yes',
        currentStep: 'scope',
        pendingSuggestion: {
          status: 'awaiting',
          step: 'scope',
          patch: { scopeIn: 'not a list' },
        },
      },
    });
    expect(result.helper?.saved).toBeNull();
    expect(result.reply).toBe('What should be in scope?');
  });

  it('returns no helper result when the model fails, so the client falls back', async () => {
    generateText.mockRejectedValue(new Error('timeout'));
    const result = await assistSpaceQuestDraft({
      spaceSlug: 'sandbox',
      input: { message: 'yes', currentStep: 'goal' },
    });
    expect(result.helper).toBeUndefined();
    expect(result.reply).toBeNull();
    expect(result.patch).toBeNull();
  });
});
