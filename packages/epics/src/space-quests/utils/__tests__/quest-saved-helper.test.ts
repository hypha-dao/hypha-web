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
  SAVED_QUEST_HELPER_SAVE_FAILED,
  SAVED_QUEST_HELPER_SAVED,
  SAVED_QUEST_HELPER_UNCHANGED,
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
    expect(outcome?.reply).toBe(SAVED_QUEST_HELPER_SAVED);
    expect(outcome?.reply).not.toMatch(/CREATE QUEST/i);

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
    expect(scoped?.reply).toMatch(/Added that to the Goal/i);
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
});
