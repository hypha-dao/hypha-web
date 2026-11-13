import { describe, expect, it, vi } from 'vitest';
import {
  QUEST_HELPER_OFFLINE_REPLY,
  questDraftTurnUsesModel,
  questHelperPendingSuggestion,
  settleCreateDraftTurn,
  type CreateDraftTurnSnapshot,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftStateSnapshot,
} from '../quest-draft-assistant';
import { runSavedQuestHelperTurn } from '../quest-saved-helper';

const goal =
  'Confirm that the Quest feature works end to end in this sandbox, so the flow can be trusted for real work here.';

const draftWithGoal: QuestDraftStateSnapshot = {
  name: '',
  goal,
  scopeIn: [],
  scopeOut: [],
  scopeInMarkdown: '',
  scopeOutMarkdown: '',
  successCriteria: '',
  rewards: [],
  milestones: [],
  leadName: 'Vlad Hramtsov (you)',
  selectedLeadPersonId: 56,
  members: [],
  targetDate: null,
};

const scopeCard: PendingQuestSectionProposal = {
  step: 'scope',
  patch: {
    scopeIn: [
      'Defining one Quest in this space end to end',
      'Publishing that Quest as an Agreements proposal',
    ],
    scopeOut: ['Fixing anything the test surfaces'],
  },
};

function settle(
  message: string,
  state: CreateDraftTurnSnapshot,
  model: QuestDraftModelTurn | null,
) {
  const loadModel = vi.fn(async () => model);
  const result = settleCreateDraftTurn({
    message,
    viewerDisplayName: 'Vlad Hramtsov',
    spaceMembers: [],
    readState: () => state,
    isCurrent: () => true,
    loadModel,
  });
  return { result, loadModel };
}

describe('quest helper agent turn', () => {
  it('sends yes and every approval phrasing to the agent', () => {
    for (const message of [
      'yes',
      'yes I want you to add that to scope',
      'add your suggestions to scope',
      'think yourself',
    ]) {
      expect(questDraftTurnUsesModel(message)).toBe(true);
    }
    expect(questDraftTurnUsesModel('Set the goal to "Ship it"')).toBe(false);
  });

  it('sends the waiting card with its patch so the agent can confirm it', () => {
    expect(questHelperPendingSuggestion(null)).toEqual({ status: 'none' });
    const body = questHelperPendingSuggestion(scopeCard);
    expect(body.status).toBe('awaiting');
    expect(body.step).toBe('scope');
    expect(body.patch).toEqual(scopeCard.patch);
    expect(body.wording).toContain('Defining one Quest in this space');
  });

  it('writes the waiting Scope card when the agent confirms "yes I want you to add that to scope"', async () => {
    const { result, loadModel } = settle(
      'yes I want you to add that to scope',
      { draft: draftWithGoal, pending: scopeCard, currentStep: 'scope' },
      {
        reply:
          'Scope is saved. Next is Success criteria: what could a reviewer check to call this validated?',
        patch: null,
        helper: {
          suggestion: null,
          saved: {
            step: 'scope',
            patch: { scopeIn: ['a different line the agent tried to save'] },
            source: 'pending',
          },
          discarded: false,
        },
      },
    );
    const turn = await result;
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(turn?.wrote).toBe(true);
    expect(turn?.draft.scopeIn).toEqual(scopeCard.patch.scopeIn);
    expect(turn?.draft.scopeOut).toEqual(scopeCard.patch.scopeOut);
    expect(turn?.draft.goal).toBe(goal);
    expect(turn?.pending).toBeNull();
    expect(turn?.focusStep).toBe('success');
    expect(turn?.reply).toMatch(/^Added that to the Scope\./);
    expect(turn?.reply).toMatch(/what could a reviewer check/);
    expect(turn?.reply).not.toMatch(/Scope is saved/);
    expect(turn?.reply).not.toContain(QUEST_HELPER_OFFLINE_REPLY);
  });

  it('saves wording the agent showed in prose when the member says "add your suggestions to scope"', async () => {
    const { result } = settle(
      'add your suggestions to scope',
      { draft: draftWithGoal, pending: null, currentStep: 'scope' },
      {
        reply: 'What could a reviewer check to call this validated?',
        helper: {
          suggestion: null,
          saved: { ...scopeCard, source: 'shown' },
          discarded: false,
        },
      },
    );
    const turn = await result;
    expect(turn?.wrote).toBe(true);
    expect(turn?.draft.scopeIn).toEqual(scopeCard.patch.scopeIn);
    expect(turn?.reply).not.toMatch(/Nothing is waiting/);
  });

  it('shows the agent suggestion as a card and keeps it waiting', async () => {
    const { result } = settle(
      'think yourself',
      { draft: draftWithGoal, pending: null, currentStep: 'scope' },
      {
        reply: 'A tight boundary for a throwaway sandbox test.',
        patch: scopeCard.patch,
        helper: { suggestion: scopeCard, saved: null, discarded: false },
      },
    );
    const turn = await result;
    expect(turn?.wrote).toBe(false);
    expect(turn?.pending).toEqual(scopeCard);
    expect(turn?.reply).toMatch(/A tight boundary/);
    expect(turn?.reply).toMatch(/Not saved yet/);
    expect(turn?.reply).toContain(
      'Defining one Quest in this space end to end',
    );
    expect(turn?.reply).toMatch(/Do you want that to be in the Scope\?/);
  });

  it('keeps a waiting card through a chat turn and drops it on discard', async () => {
    const chat = await settle(
      'is that narrow enough?',
      { draft: draftWithGoal, pending: scopeCard, currentStep: 'scope' },
      {
        reply: 'Yes, it is narrow enough for one sandbox test.',
        helper: { suggestion: null, saved: null, discarded: false },
      },
    ).result;
    expect(chat?.pending).toEqual(scopeCard);
    expect(chat?.wrote).toBe(false);

    const rejected = await settle(
      'no, not that',
      { draft: draftWithGoal, pending: scopeCard, currentStep: 'scope' },
      {
        reply: 'What should change?',
        helper: { suggestion: null, saved: null, discarded: true },
      },
    ).result;
    expect(rejected?.pending).toBeNull();
    expect(rejected?.draft.scopeIn).toEqual([]);
  });

  it('drops an unbacked save claim when the agent did not save', async () => {
    const turn = await settle(
      'hmm',
      { draft: draftWithGoal, pending: scopeCard, currentStep: 'scope' },
      {
        reply: 'Scope is set: two in-scope items.',
        helper: { suggestion: null, saved: null, discarded: false },
      },
    ).result;
    expect(turn?.wrote).toBe(false);
    expect(turn?.reply).not.toMatch(/Scope is set/);
    expect(turn?.reply).toMatch(/Do you want that to be in the Scope\?/);
  });

  it('still applies a plain yes locally when the agent cannot be reached', async () => {
    const turn = await settle(
      'yes',
      { draft: draftWithGoal, pending: scopeCard, currentStep: 'scope' },
      null,
    ).result;
    expect(turn?.wrote).toBe(true);
    expect(turn?.draft.scopeIn).toEqual(scopeCard.patch.scopeIn);
  });

  it('saves a saved quest section the agent confirmed', async () => {
    const saveSection = vi.fn(async () => true);
    const outcome = await runSavedQuestHelperTurn({
      message: 'looks good, save it',
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => ({
        draft: draftWithGoal,
        pending: { step: 'goal', patch: { goal: 'A shorter saved goal.' } },
        currentStep: 'goal',
      }),
      isCurrent: () => true,
      loadModel: async () => ({
        reply: 'Which section next?',
        helper: {
          suggestion: null,
          saved: {
            step: 'goal',
            patch: { goal: 'A shorter saved goal.' },
            source: 'pending',
          },
          discarded: false,
        },
      }),
      saveSection,
    });
    expect(saveSection).toHaveBeenCalledTimes(1);
    expect(outcome?.saved).toBe(true);
    expect(outcome?.reply).toBe('Saved the Goal.');
  });

  it('answers a read of the saved section in plain text and does not call the agent', async () => {
    const filled: QuestDraftStateSnapshot = {
      name: 'Sandbox edit test',
      goal: 'Prove that quest editing works in this open-access sandbox.',
      scopeIn: ['Open the existing saved quest in this sandbox'],
      scopeOut: ['Changing production'],
      scopeInMarkdown: '',
      scopeOutMarkdown: '',
      successCriteria: 'A reviewer can repeat the edit',
      rewards: [{ amount: '10', token: 'HYPHA' }],
      milestones: [
        {
          name: 'QA pass',
          description: '',
          dueDate: '2026-12-01',
          ownerName: null,
          status: 'not_started',
        },
      ],
      leadName: 'Ada Lovelace',
      selectedLeadPersonId: 7,
      members: [],
      targetDate: '2026-12-15',
    };
    const invented: QuestDraftModelTurn = {
      reply: 'Here is tighter wording.',
      patch: { scopeIn: ['Invented scope line'] },
      helper: {
        suggestion: {
          step: 'scope',
          patch: { scopeIn: ['Invented scope line'] },
        },
        saved: null,
        discarded: false,
      },
    };
    const cases: Array<{ message: string; saved: string }> = [
      {
        message: '@Quest Helper what is the goal?',
        saved: filled.goal,
      },
      {
        message: 'helper: what is the scope?',
        saved: 'Open the existing saved quest in this sandbox',
      },
      {
        message: 'what does the success criteria say?',
        saved: 'A reviewer can repeat the edit',
      },
      {
        message: 'show me the milestones',
        saved: 'QA pass',
      },
      {
        message: 'what are the rewards?',
        saved: '10 HYPHA',
      },
      {
        message: "what's the target date?",
        saved: '2026-12-15',
      },
    ];
    for (const { message, saved } of cases) {
      const { result, loadModel } = settle(
        message,
        { draft: filled, pending: scopeCard, currentStep: 'scope' },
        invented,
      );
      const turn = await result;
      expect(loadModel, message).not.toHaveBeenCalled();
      expect(turn?.wrote, message).toBe(false);
      expect(turn?.pending, message).toBeNull();
      expect(turn?.reply, message).toContain(saved);
      expect(turn?.reply, message).not.toMatch(/not saved yet/i);
      expect(turn?.reply, message).not.toContain('Invented scope line');
      expect(turn?.draft.goal, message).toBe(filled.goal);
      expect(turn?.draft.scopeIn, message).toEqual(filled.scopeIn);
    }
  });

  it('says when the asked section is empty instead of inventing one', async () => {
    const { result, loadModel } = settle(
      'what is the scope?',
      { draft: draftWithGoal, pending: null, currentStep: 'goal' },
      {
        reply: 'In: Open the existing saved quest.',
        helper: {
          suggestion: scopeCard,
          saved: null,
          discarded: false,
        },
      },
    );
    const turn = await result;
    expect(loadModel).not.toHaveBeenCalled();
    expect(turn?.pending).toBeNull();
    expect(turn?.reply).toBe('The Scope is empty.');
  });

  it('still asks the agent to propose wording that is not a read of the saved section', async () => {
    const { result, loadModel } = settle(
      'what should the goal be?',
      { draft: draftWithGoal, pending: null, currentStep: 'goal' },
      {
        reply: 'A reviewer could check that the edit can be repeated.',
        helper: { suggestion: null, saved: null, discarded: false },
      },
    );
    const turn = await result;
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(turn?.pending).toBeNull();
    expect(turn?.reply).toMatch(/reviewer could check/);
  });
});
