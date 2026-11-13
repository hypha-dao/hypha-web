import { describe, expect, it, vi } from 'vitest';
import type { QuestStewardStep } from '@hypha-platform/core/client';
import { storedQuestRichText } from '../quest-rich-text';
import type {
  PendingQuestSectionProposal,
  QuestDraftModelTurn,
  QuestDraftStateSnapshot,
} from '../quest-draft-assistant';
import {
  SAVED_QUEST_HELPER_NOT_SAVED,
  SAVED_QUEST_HELPER_NOTHING_PENDING,
  SAVED_QUEST_HELPER_SAVE_FAILED,
  SAVED_QUEST_HELPER_UNCHANGED,
  preserveQuestMarkdown,
  planSavedHelperWrite,
  questHelperDraftAssistBody,
  questRecordToDraftSnapshot,
  runSavedQuestHelperTurn,
} from '../quest-saved-helper';

const saved = questRecordToDraftSnapshot({
  name: 'Onboarding',
  goal: 'Keep the saved goal.',
  scopeIn: ['docs'],
  scopeOut: ['payroll'],
  scopeInMarkdown: '- docs',
  scopeOutMarkdown: '- payroll',
  successCriteria: '- members finish',
  rewards: [{ amount: '10', token: 'USDC' }],
  targetDate: '2026-12-01',
  leadPersonId: 4,
  leadName: 'Ada Lovelace',
  milestones: [
    {
      id: 1,
      name: 'Draft',
      description: 'Notes',
      dueDate: null,
      ownerPersonId: 4,
      ownerName: 'Ada Lovelace',
      status: 'in_progress',
    },
    {
      id: 2,
      name: 'Review',
      description: 'Read',
      dueDate: null,
      ownerPersonId: null,
      ownerName: null,
      status: 'done',
    },
  ],
  members: [
    {
      id: 9,
      personId: 4,
      memberName: 'Ada Lovelace',
      memberAvatarUrl: null,
      roleLabel: 'Lead',
      responsibilities: ['Own delivery'],
    },
  ],
});

function turn(options: {
  message: string;
  pending?: PendingQuestSectionProposal | null;
  save?: (patch: unknown) => Promise<boolean>;
  draft?: QuestDraftStateSnapshot;
  loadModel?: () => Promise<QuestDraftModelTurn | null>;
}) {
  const state: {
    draft: QuestDraftStateSnapshot;
    pending: PendingQuestSectionProposal | null;
    currentStep: QuestStewardStep;
  } = {
    draft: options.draft ?? saved,
    pending: options.pending ?? null,
    currentStep: 'goal',
  };
  const saveSection = vi.fn(options.save ?? (async () => true));
  return {
    saveSection,
    run: () =>
      runSavedQuestHelperTurn({
        message: options.message,
        viewerDisplayName: 'Ada Lovelace',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => options.loadModel?.() ?? null,
        saveSection,
      }),
  };
}

describe('saved quest helper', () => {
  it('sends the saved quest as helper context and does not name a quest slug', () => {
    const body = questHelperDraftAssistBody({
      message: 'make the goal shorter',
      currentStep: 'goal',
      spaceTitle: 'Sandbox',
      draft: saved,
      spaceMembers: [{ personId: 4, name: 'Ada Lovelace' }],
      history: [],
      pendingSuggestion: { status: 'none' },
    });
    expect(body.draft.goal).toBe('Keep the saved goal.');
    expect(body.draft.milestones.map((milestone) => milestone.name)).toEqual([
      'Draft',
      'Review',
    ]);
    expect(body).not.toHaveProperty('questSlug');
  });

  it('yes saves only the confirmed goal through the rich-text store path', async () => {
    const goal = 'Ship the onboarding checklist for new members.';
    const { run, saveSection } = turn({
      message: 'yes',
      pending: { step: 'goal', patch: { goal } },
      loadModel: async () => {
        throw new Error('yes must not call the model');
      },
    });
    const outcome = await run();
    expect(saveSection).toHaveBeenCalledTimes(1);
    expect(saveSection.mock.calls[0]?.[0]).toEqual({
      goal: storedQuestRichText(goal),
    });
    expect(outcome?.saved).toBe(true);
    expect(outcome?.pending).toBeNull();
    expect(outcome?.reply).toBe('Saved the Goal.');
    expect(outcome?.reply).not.toMatch(/CREATE QUEST/i);
    expect(outcome?.reply).not.toMatch(/Quest Reward/i);
    expect(outcome?.reply).not.toMatch(/succeeded/i);
    expect(outcome?.reply).not.toBe('.');

    const incomplete = turn({
      message: 'yes',
      draft: {
        ...saved,
        scopeIn: [],
        scopeOut: [],
        scopeInMarkdown: '',
        scopeOutMarkdown: '',
      },
      pending: { step: 'goal', patch: { goal } },
    });
    const scoped = await incomplete.run();
    expect(incomplete.saveSection.mock.calls[0]?.[0]).toEqual({
      goal: storedQuestRichText(goal),
    });
    expect(scoped?.reply).toBe('Saved the Goal.');
    expect(scoped?.reply).not.toMatch(/quest you want to create/i);
  });

  it('keeps the suggestion when the save fails', async () => {
    const pending = {
      step: 'goal' as const,
      patch: { goal: 'Ship the onboarding checklist for new members.' },
    };
    const { run, saveSection } = turn({
      message: 'yes',
      pending,
      save: async () => false,
    });
    const outcome = await run();
    expect(saveSection).toHaveBeenCalledTimes(1);
    expect(outcome?.saved).toBe(false);
    expect(outcome?.pending).toEqual(pending);
    expect(outcome?.reply).toBe(SAVED_QUEST_HELPER_SAVE_FAILED);
    expect(outcome?.reply).not.toMatch(/Added that/i);
  });

  it('does not save when the confirmed section already matches', async () => {
    const goal = storedQuestRichText(
      'Ship the onboarding checklist for new members.',
    );
    const { run, saveSection } = turn({
      message: 'yes',
      draft: { ...saved, goal },
      pending: { step: 'goal', patch: { goal } },
    });
    const outcome = await run();
    expect(saveSection).not.toHaveBeenCalled();
    expect(outcome?.reply).toBe(SAVED_QUEST_HELPER_UNCHANGED);
    expect(outcome?.pending).toBeNull();
  });

  it('does not save a question or a patch that changes more than one section', async () => {
    const question = turn({
      message: 'what should the goal be?',
      pending: {
        step: 'goal',
        patch: { goal: 'Ship the onboarding checklist for new members.' },
      },
      loadModel: async () => ({ reply: 'Tell me who it is for.', patch: null }),
    });
    const asked = await question.run();
    expect(question.saveSection).not.toHaveBeenCalled();
    expect(asked?.saved).toBe(false);

    const plan = planSavedHelperWrite(saved, {
      ...saved,
      goal: 'A different saved goal.',
      name: 'A different name',
    });
    expect(plan.kind).toBe('blocked');
    expect(SAVED_QUEST_HELPER_NOT_SAVED).toMatch(/still waiting/i);
  });

  it('saves a reordered milestone list with the same ids and statuses', () => {
    const plan = planSavedHelperWrite(saved, {
      ...saved,
      milestones: [
        {
          name: 'Review',
          description: 'Read',
          dueDate: null,
          ownerPersonId: null,
          ownerName: null,
          status: 'not_started',
        },
        {
          name: 'Draft',
          description: 'Notes',
          dueDate: null,
          ownerPersonId: null,
          ownerName: 'Ada Lovelace',
          status: 'not_started',
        },
      ],
    });
    expect(plan.kind).toBe('save');
    if (plan.kind !== 'save') return;
    expect(plan.patch).toEqual({
      milestones: [
        {
          id: 2,
          name: 'Review',
          description: storedQuestRichText('Read'),
          dueDate: null,
          ownerPersonId: null,
          ownerName: null,
          status: 'done',
        },
        {
          id: 1,
          name: 'Draft',
          description: storedQuestRichText('Notes'),
          dueDate: null,
          ownerPersonId: 4,
          ownerName: 'Ada Lovelace',
          status: 'in_progress',
        },
      ],
    });
    expect(plan.patch).not.toHaveProperty('goal');
  });

  it('does not save a lead that has no person', () => {
    const plan = planSavedHelperWrite(saved, {
      ...saved,
      leadName: 'Grace Hopper',
      selectedLeadPersonId: null,
    });
    expect(plan.kind).toBe('blocked');
  });

  it('answers yes with nothing pending in edit mode', async () => {
    const outcome = await turn({ message: 'yes' }).run();
    expect(outcome?.saved).toBe(false);
    expect(outcome?.pending).toBeNull();
    expect(outcome?.reply).toBe(SAVED_QUEST_HELPER_NOTHING_PENDING);
    expect(outcome?.reply).not.toMatch(/quest you want to create/i);
  });

  it('files the quoted Scope In addition instead of claiming it now reads', async () => {
    const { run, saveSection } = turn({
      message: 'Add "Terse test" to Scope In',
      loadModel: async () => ({
        reply:
          'Scope In now reads: Terse test. How will we know this quest succeeded?',
        patch: null,
      }),
    });
    const outcome = await run();
    expect(saveSection).not.toHaveBeenCalled();
    expect(outcome?.pending?.patch.scopeIn).toEqual(['docs', 'Terse test']);
    expect(outcome?.reply).toContain('docs');
    expect(outcome?.reply).toContain('Terse test');
    expect(outcome?.reply).not.toMatch(/now reads/i);
    expect(outcome?.reply).not.toMatch(/succeeded/i);
  });

  it('keeps existing scope items on the card and in the saved patch', async () => {
    const draft: QuestDraftStateSnapshot = {
      ...saved,
      scopeIn: ['Edit each section'],
      scopeOut: ['Production rollout'],
      scopeInMarkdown: '- Edit each section',
      scopeOutMarkdown: '- Production rollout',
    };
    const state: {
      draft: QuestDraftStateSnapshot;
      pending: PendingQuestSectionProposal | null;
      currentStep: QuestStewardStep;
    } = { draft, pending: null, currentStep: 'goal' };
    const saveSection = vi.fn(async (_patch: Record<string, unknown>) => true);
    const run = (message: string, model: QuestDraftModelTurn | null) =>
      runSavedQuestHelperTurn({
        message,
        viewerDisplayName: 'Ada Lovelace',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => model,
        saveSection,
      });
    const proposed = await run('Scope In: Check helper in chat', {
      reply: 'keeps "Edit each section" and adds Check helper in chat',
      patch: { scopeIn: ['Check helper in chat'] },
    });
    expect(proposed?.pending?.patch.scopeIn).toEqual([
      'Edit each section',
      'Check helper in chat',
    ]);
    expect(proposed?.reply).toContain('Edit each section');
    expect(proposed?.reply).toContain('Check helper in chat');
    state.pending = proposed?.pending ?? null;

    const savedIn = await run('yes', null);
    expect(savedIn?.reply).toBe('Saved the Scope.');
    expect(savedIn?.reply).not.toMatch(/Quest Reward|succeeded|CREATE QUEST/i);
    expect(saveSection.mock.calls[0]?.[0]).toMatchObject({
      scopeIn: ['Edit each section', 'Check helper in chat'],
      scopeOut: ['Production rollout'],
    });

    state.pending = null;
    const scopeOut = await run('Scope Out: Mobile app', {
      reply: 'Scope Out now reads Mobile app.',
      patch: { scopeOut: ['Mobile app'] },
    });
    expect(scopeOut?.pending?.patch.scopeOut).toEqual([
      'Production rollout',
      'Mobile app',
    ]);
    expect(scopeOut?.reply).toContain('Production rollout');
    expect(scopeOut?.reply).toContain('Mobile app');
    expect(scopeOut?.reply).not.toMatch(/now reads/i);
  });

  it('proposes a Scope In card when the assistant reply is empty', async () => {
    const outcome = await turn({
      message:
        'Please propose adding "Check helper in chat" to Scope In for my confirmation',
      loadModel: async () => null,
    }).run();
    expect(outcome?.pending?.patch.scopeIn).toEqual([
      'docs',
      'Check helper in chat',
    ]);
    expect(outcome?.reply).toContain('Check helper in chat');
    expect(outcome?.reply).not.toMatch(/can't reach the assistant/i);
    expect(outcome?.reply).not.toMatch(/Quest Reward/i);

    const scopeOut = await turn({
      message:
        'Please propose adding "Mobile app" to Scope Out for my confirmation',
      draft: {
        ...saved,
        scopeOut: ['Production rollout'],
        scopeOutMarkdown: '- Production rollout',
      },
      loadModel: async () => null,
    }).run();
    expect(scopeOut?.pending?.patch.scopeOut).toEqual([
      'Production rollout',
      'Mobile app',
    ]);
    expect(scopeOut?.reply).not.toMatch(/can't reach the assistant/i);
  });

  it('rejects a goal card when the edit named Success', async () => {
    const { run, saveSection } = turn({
      message: 'Add "the app ships" to Success',
      loadModel: async () => ({
        reply: 'Goal now reads a different outcome.',
        patch: { goal: 'A different outcome for this quest.' },
      }),
    });
    const outcome = await run();
    expect(saveSection).not.toHaveBeenCalled();
    expect(outcome?.pending).toBeNull();
    expect(outcome?.reply).not.toMatch(/do you want that to be in the goal/i);
    expect(outcome?.reply).toMatch(/did not file a suggestion/i);
  });

  it('files a success card when the tool patch matches Success', async () => {
    const outcome = await turn({
      message: 'Add "the app ships" to Success',
      loadModel: async () => ({
        reply: 'Success now reads the app ships.',
        patch: { successCriteriaBullets: ['the app ships'] },
      }),
    }).run();
    expect(outcome?.saved).toBe(false);
    expect(outcome?.pending?.step).toBe('success');
    expect(outcome?.reply).toMatch(/do you want that to be in the success/i);
    expect(outcome?.reply).not.toMatch(/now reads/i);
  });

  it('keeps a paragraph and does not add a period unless asked', () => {
    expect(
      preserveQuestMarkdown(
        'Mobile app',
        '- Mobile app.',
        'Add "Check helper edits" to Scope In',
      ),
    ).toBe('Mobile app');
    expect(
      preserveQuestMarkdown(
        'Mobile app',
        '- Mobile app.\n- Check helper edits.',
        'Add "Check helper edits" to Scope In',
      ),
    ).toBe('Mobile app Check helper edits');
    expect(
      preserveQuestMarkdown(
        '- Mobile app',
        '- Mobile app.\n- Check helper edits.',
        'Add "Check helper edits" to Scope In',
      ),
    ).toBe('- Mobile app\n- Check helper edits');
    expect(
      preserveQuestMarkdown('Mobile app', '- Mobile app.', 'Make it a list'),
    ).toBe('- Mobile app');
  });
});
