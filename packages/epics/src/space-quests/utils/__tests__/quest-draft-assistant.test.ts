import { describe, expect, it } from 'vitest';
import {
  resolveQuestDraftTarget,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import {
  applyPatchToQuestDraftState,
  buildLocalQuestDraftPatch,
  decideNewQuestDraftTurn,
  findNextUnfilledQuestStep,
  formatPendingQuestPatch,
  isQuestSectionApproval,
  isQuestSectionCoachingOpener,
  questDraftTurnUsesModel,
  replyWithSectionApprovalAsk,
  runNewQuestDraftTurn,
  stripQuestMetaInstructions,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftStateSnapshot,
} from '../quest-draft-assistant';

const emptyDraft: QuestDraftStateSnapshot = {
  name: '',
  goal: '',
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

describe('quest-draft-assistant', () => {
  it('records only the goal when the member states a goal', () => {
    const patch = buildLocalQuestDraftPatch({
      message: 'We want to build an onboarding matcher for new joiners.',
      currentStep: 'goal',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch).toEqual({
      goal: 'We want to build an onboarding matcher for new joiners.',
    });
    const { next, updatedLabels } = applyPatchToQuestDraftState({
      current: emptyDraft,
      patch,
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(updatedLabels).toEqual(['Goal']);
    expect(next.name).toBe('');
    expect(next.scopeIn).toEqual([]);
    expect(next.milestones).toEqual([]);
    expect(findNextUnfilledQuestStep(next, 'goal')).toBe('scope');
  });

  it('does not invent other sections from a bulk draft request', () => {
    const withGoal: QuestDraftStateSnapshot = {
      ...emptyDraft,
      goal: 'Validate quest creation and member pickers in the sandbox space.',
    };
    const patch = buildLocalQuestDraftPatch({
      message:
        'Draft the Scope, Success Criteria, and Milestones sections from our goal.',
      currentStep: 'scope',
      draft: withGoal,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch).toEqual({});
    const { next, updatedLabels } = applyPatchToQuestDraftState({
      current: withGoal,
      patch,
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(updatedLabels).toEqual([]);
    expect(next.scopeIn).toEqual([]);
    expect(next.successCriteria).toBe('');
    expect(next.milestones).toEqual([]);
    expect(next.targetDate).toBeNull();
    expect(findNextUnfilledQuestStep(next, 'goal')).toBe('scope');
  });

  it('keeps a labeled brief on the active section', () => {
    const message =
      'Goal: Ship Context v2\nIn: Markdown editor; Agent prompts\nOut: Cross-space search\nReward: 2,500 USDC + 0.4 ETH';
    const onGoal = buildLocalQuestDraftPatch({
      message,
      currentStep: 'goal',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(onGoal).toEqual({ goal: 'Ship Context v2' });

    const onScope = buildLocalQuestDraftPatch({
      message,
      currentStep: 'scope',
      draft: { ...emptyDraft, goal: 'Ship Context v2' },
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(onScope.scopeIn).toEqual(['Markdown editor', 'Agent prompts']);
    expect(onScope.scopeOut).toEqual(['Cross-space search']);
    expect(onScope.goal).toBeUndefined();
    expect(onScope.rewards).toBeUndefined();

    const withOutLabel = [
      'In: Run three sandbox onboarding checks and record pass/fail for each',
      'Out of scope:',
      '- Fixing the onboarding flow',
      '- Contacting real people',
      '- Payments or on-chain actions',
    ].join('\n');
    const separated = buildLocalQuestDraftPatch({
      message: withOutLabel,
      currentStep: 'scope',
      draft: { ...emptyDraft, goal: 'Ship Context v2' },
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(separated.scopeIn).toEqual([
      'Run three sandbox onboarding checks and record pass/fail for each',
    ]);
    expect(separated.scopeOut).toEqual([
      'Fixing the onboarding flow',
      'Contacting real people',
      'Payments or on-chain actions',
    ]);
    expect(separated.scopeIn?.join('\n')).not.toMatch(/fixing the onboarding/i);
  });

  it('does not fill scope from "draft everything"', () => {
    const withGoal: QuestDraftStateSnapshot = {
      ...emptyDraft,
      goal: 'Validate the sandbox onboarding checklist.',
    };
    const patch = buildLocalQuestDraftPatch({
      message: 'Please draft everything for me.',
      currentStep: 'scope',
      draft: withGoal,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch).toEqual({});
  });

  it('holds a section until the member approves it', () => {
    expect(isQuestSectionCoachingOpener("Now let's define the scope")).toBe(
      true,
    );
    expect(
      decideNewQuestDraftTurn({
        message: "Now let's define the scope",
        currentStep: 'goal',
        targetStep: 'scope',
        bulk: false,
        pending: null,
      }),
    ).toEqual({ kind: 'coach', step: 'scope' });

    const proposed = decideNewQuestDraftTurn({
      message: 'In: the sandbox checklist. Out: voting.',
      currentStep: 'scope',
      targetStep: 'scope',
      bulk: false,
      pending: null,
    });
    expect(proposed.kind).toBe('propose');

    expect(isQuestSectionApproval('yes')).toBe(true);
    expect(isQuestSectionApproval('okay')).toBe(true);
    expect(isQuestSectionApproval('Okay')).toBe(true);
    expect(isQuestSectionApproval('put that in Scope')).toBe(true);
    expect(
      isQuestSectionApproval(
        'Yes, all three checks run inside the sandbox with throwaway accounts.',
      ),
    ).toBe(false);

    expect(
      decideNewQuestDraftTurn({
        message: 'put that in Scope',
        currentStep: 'success',
        targetStep: 'success',
        bulk: false,
        pending: {
          step: 'scope',
          patch: { scopeIn: ['Sandbox checklist'], scopeOut: ['Voting'] },
        },
      }),
    ).toEqual({
      kind: 'apply',
      step: 'scope',
      patch: { scopeIn: ['Sandbox checklist'], scopeOut: ['Voting'] },
    });
  });

  it('accepts a verbose yes as approval of the pending section', () => {
    const pending = {
      step: 'goal' as const,
      patch: {
        goal: 'Validate sandbox onboarding with three documented checks by 30 November 2026.',
      },
    };
    for (const message of [
      'Yes, put that in the Goal.',
      'yes please',
      'okay',
      'Okay',
      'Okay, put that in the Goal',
      'I approve',
      'include that',
      'put that in the Goal',
    ]) {
      expect(isQuestSectionApproval(message)).toBe(true);
      expect(
        decideNewQuestDraftTurn({
          message,
          currentStep: 'goal',
          targetStep: 'goal',
          bulk: false,
          pending,
        }),
      ).toEqual({ kind: 'apply', step: 'goal', patch: pending.patch });
    }

    expect(
      decideNewQuestDraftTurn({
        message: 'yes',
        currentStep: 'goal',
        targetStep: 'goal',
        bulk: false,
        pending: null,
      }).kind,
    ).not.toBe('apply');
    expect(
      decideNewQuestDraftTurn({
        message: 'Yes, put that in the Goal.',
        currentStep: 'goal',
        targetStep: 'goal',
        bulk: false,
        pending: null,
      }).kind,
    ).not.toBe('apply');
  });

  it('treats okay as approval, not a leftover ay after matching ok', () => {
    expect(isQuestSectionApproval('okay')).toBe(true);
    expect(isQuestSectionApproval('ok')).toBe(true);
    expect(isQuestSectionApproval('Okay, put that in the Goal')).toBe(true);
  });

  it('quotes the proposed wording in the confirm message', () => {
    const patch = {
      scopeIn: ['Sandbox-only, with throwaway test accounts'],
      scopeOut: ['Payments and on-chain actions'],
    };
    const reply = replyWithSectionApprovalAsk(
      'Waiting on your yes before anything is applied to the form. Do you want that to be in the Scope?',
      'scope',
      patch,
    );
    expect(reply).toContain('Sandbox-only, with throwaway test accounts');
    expect(reply).toContain('Payments and on-chain actions');
    expect(reply).toContain('Do you want that to be in the Scope?');
    expect(reply).not.toContain('Waiting on your yes');
  });

  it('strips tester instructions from success criteria before they are written', () => {
    const message = [
      '- all three checks are run with throwaway accounts',
      '- each check has a recorded pass or fail',
      '- a short findings note is posted by 30 November 2026. Please write these as Success Criteria, proposing in chat first.',
    ].join('\n');
    expect(stripQuestMetaInstructions(message)).not.toMatch(
      /proposing in chat/i,
    );
    expect(
      stripQuestMetaInstructions('Please review the checklist by Friday.'),
    ).toBe('Please review the checklist by Friday.');

    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: 'success',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.successCriteriaBullets).toEqual([
      'all three checks are run with throwaway accounts',
      'each check has a recorded pass or fail',
      'a short findings note is posted by 30 November 2026.',
    ]);
    const { next } = applyPatchToQuestDraftState({
      current: emptyDraft,
      patch: {
        successCriteriaBullets: [
          'a short findings note is posted by 30 November 2026. Please write these as Success Criteria, proposing in chat first.',
        ],
      },
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(next.successCriteria).not.toMatch(/please write these/i);
    expect(next.successCriteria).toContain('30 November 2026');
  });

  it('keeps leading digits that are part of semicolon-separated item text', () => {
    const patch = buildLocalQuestDraftPatch({
      message: '60% join a Space; 1. ship the matcher; - document the flow',
      currentStep: 'success',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.successCriteriaBullets).toEqual([
      '60% join a Space',
      'ship the matcher',
      'document the flow',
    ]);

    const numeric = buildLocalQuestDraftPatch({
      message:
        '2.5 hours of review; 60% stay enrolled; 10) file the note; • 60% published',
      currentStep: 'success',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(numeric.successCriteriaBullets).toEqual([
      '2.5 hours of review',
      '60% stay enrolled',
      'file the note',
      '60% published',
    ]);
  });

  it('proposes only the milestones the member named', () => {
    const message =
      'Milestones: M1 Run check one, due 20 November 2026. M2 Run check two, due 25 November 2026. M3 Run check three and post findings note, due 30 November 2026. Owner Vlad for all. Please propose these as Milestones in chat first.';
    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.milestones).toEqual([
      {
        name: 'Run check one',
        dueDate: '20 November 2026',
        description: 'Run check one',
        ownerName: 'Vlad',
      },
      {
        name: 'Run check two',
        dueDate: '25 November 2026',
        description: 'Run check two',
        ownerName: 'Vlad',
      },
      {
        name: 'Run check three and post findings note',
        dueDate: '30 November 2026',
        description: 'Run check three and post findings note',
        ownerName: 'Vlad',
      },
    ]);
    expect(
      decideNewQuestDraftTurn({
        message,
        currentStep: 'milestones',
        targetStep: 'milestones',
        bulk: false,
        pending: null,
      }).kind,
    ).toBe('propose');

    const undated = buildLocalQuestDraftPatch({
      message: 'Ship the onboarding checklist',
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(undated.milestones?.[0]?.dueDate).toBeUndefined();
    expect(undated.milestones?.[0]?.name).toBe('Ship the onboarding checklist');
  });

  it('proposes an explicit milestones list as milestones after the goal step', () => {
    const message =
      'Exactly 3 milestones: M1 titled Run check one, due 20 November 2026; M2 titled Run check two, due 25 November 2026; M3 titled Run check three, due 30 November 2026. Owner Vlad Hramtsov for all. Please propose these as Milestones in chat first.';
    const target = resolveQuestDraftTarget(message, 'scope');
    expect(target).toEqual({ step: 'milestones', bulk: false });
    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: target.step,
      draft: {
        ...emptyDraft,
        goal: 'Validate sandbox onboarding with three documented checks by 30 November 2026.',
      },
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.scopeIn).toBeUndefined();
    expect(patch.scopeOut).toBeUndefined();
    expect(patch.milestones?.map((milestone) => milestone.name)).toEqual([
      'Run check one',
      'Run check two',
      'Run check three',
    ]);
    expect(
      decideNewQuestDraftTurn({
        message,
        currentStep: 'scope',
        targetStep: target.step,
        bulk: target.bulk,
        pending: {
          step: 'goal',
          patch: {
            goal: 'Validate sandbox onboarding with three documented checks by 30 November 2026.',
          },
        },
      }).kind,
    ).toBe('propose');
    const reply = replyWithSectionApprovalAsk(null, target.step, patch);
    expect(reply).toContain('Do you want that to be in the Milestones?');
    expect(reply).not.toMatch(/in the Scope/i);
  });

  it('proposes explicit in/out scope as scope after milestones, and waits for yes', () => {
    const message =
      'In scope: Run three sandbox onboarding checks and record pass/fail for each. Out of scope: Fixing onboarding; contacting real people; payments or on-chain actions.';
    const target = resolveQuestDraftTarget(message, 'members');
    expect(target).toEqual({ step: 'scope', bulk: false });
    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: target.step,
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.members).toBeUndefined();
    expect(patch.scopeIn).toEqual([
      'Run three sandbox onboarding checks and record pass/fail for each.',
    ]);
    expect(patch.scopeOut).toEqual([
      'Fixing onboarding',
      'contacting real people',
      'payments or on-chain actions.',
    ]);
    expect(patch.scopeIn?.join('\n')).not.toMatch(/contacting real people/i);
    expect(patch.scopeIn?.join('\n')).not.toMatch(/core outcome delivery/i);
    expect(
      decideNewQuestDraftTurn({
        message,
        currentStep: 'members',
        targetStep: target.step,
        bulk: target.bulk,
        pending: null,
      }),
    ).toEqual({ kind: 'propose', step: 'scope' });
    const reply = replyWithSectionApprovalAsk(null, target.step, patch);
    expect(reply).toContain('Do you want that to be in the Scope?');
    expect(reply).not.toMatch(/in the Members/i);
    expect(reply).not.toMatch(/core outcome delivery/i);
    expect(
      decideNewQuestDraftTurn({
        message: 'Yes, put that in the Scope.',
        currentStep: 'members',
        targetStep: 'members',
        bulk: false,
        pending: { step: 'scope', patch },
      }),
    ).toEqual({ kind: 'apply', step: 'scope', patch });
  });

  it('does not turn a milestone count instruction into a row or a title', () => {
    const message =
      'Exactly 3 milestones: M1 titled Run check one, due 20 November 2026; M2 titled Run check two, due 25 November 2026; M3 titled Run check three, due 30 November 2026. Owner Vlad Hramtsov for all three.';
    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.milestones).toEqual([
      {
        name: 'Run check one',
        dueDate: '20 November 2026',
        description: 'Run check one',
        ownerName: 'Vlad Hramtsov',
      },
      {
        name: 'Run check two',
        dueDate: '25 November 2026',
        description: 'Run check two',
        ownerName: 'Vlad Hramtsov',
      },
      {
        name: 'Run check three',
        dueDate: '30 November 2026',
        description: 'Run check three',
        ownerName: 'Vlad Hramtsov',
      },
    ]);
    expect(
      decideNewQuestDraftTurn({
        message,
        currentStep: 'milestones',
        targetStep: 'milestones',
        bulk: false,
        pending: null,
      }).kind,
    ).toBe('propose');
    const preview = formatPendingQuestPatch(patch);
    expect(preview).not.toMatch(/exactly 3 milestones/i);
    expect(preview).not.toMatch(/titled/i);
    expect(preview).not.toMatch(/three,/i);
    const reply = replyWithSectionApprovalAsk(null, 'milestones', patch);
    expect(reply).toContain(preview);
    expect(reply).toContain('Do you want that to be in the Milestones?');

    const compact = buildLocalQuestDraftPatch({
      message:
        'Exactly 3 milestones: M1 titled Run check one, due20November2026; M2 titled Run check two, due25November2026; M3 titled Run check three, due30November2026. Owner Vlad Hramtsov for all three.',
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(compact.milestones?.map((milestone) => milestone.name)).toEqual([
      'Run check one',
      'Run check two',
      'Run check three',
    ]);
    expect(compact.milestones?.map((milestone) => milestone.dueDate)).toEqual([
      '20 November 2026',
      '25 November 2026',
      '30 November 2026',
    ]);
  });

  it('splits dash-separated milestone lines into title, date, and owner', () => {
    const message = [
      'Run check one - 20 November 2026 - Vlad Hramtsov',
      'Run check two - 25 November 2026 - Vlad Hramtsov',
      'Run check three - 30 November 2026 - Vlad Hramtsov',
    ].join('\n');
    const patch = buildLocalQuestDraftPatch({
      message,
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Ada Lovelace',
    });
    expect(patch.milestones).toEqual([
      {
        name: 'Run check one',
        dueDate: '20 November 2026',
        description: 'Run check one',
        ownerName: 'Vlad Hramtsov',
      },
      {
        name: 'Run check two',
        dueDate: '25 November 2026',
        description: 'Run check two',
        ownerName: 'Vlad Hramtsov',
      },
      {
        name: 'Run check three',
        dueDate: '30 November 2026',
        description: 'Run check three',
        ownerName: 'Vlad Hramtsov',
      },
    ]);
    const preview = formatPendingQuestPatch(patch);
    expect(preview).not.toMatch(/Run check one\s+-/);
    expect(preview).toContain(
      'M1 · Run check one (20 November 2026 · Vlad Hramtsov)',
    );
    expect(
      decideNewQuestDraftTurn({
        message,
        currentStep: 'milestones',
        targetStep: 'milestones',
        bulk: false,
        pending: null,
      }).kind,
    ).toBe('propose');
    expect(
      decideNewQuestDraftTurn({
        message: 'Yes, put that in the Milestones.',
        currentStep: 'milestones',
        targetStep: 'milestones',
        bulk: false,
        pending: { step: 'milestones', patch },
      }).kind,
    ).toBe('apply');

    const { next } = applyPatchToQuestDraftState({
      current: emptyDraft,
      patch,
      spaceMembers: [],
      viewerDisplayName: 'Ada Lovelace',
    });
    expect(next.milestones.map((milestone) => milestone.name)).toEqual([
      'Run check one',
      'Run check two',
      'Run check three',
    ]);
    expect(next.milestones.map((milestone) => milestone.ownerName)).toEqual([
      'Vlad Hramtsov',
      'Vlad Hramtsov',
      'Vlad Hramtsov',
    ]);

    const hyphenated = buildLocalQuestDraftPatch({
      message: 'Ship the on-chain checklist',
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(hyphenated.milestones?.[0]?.name).toBe(
      'Ship the on-chain checklist',
    );
    const titledDash = buildLocalQuestDraftPatch({
      message: 'Run check one - record the pass or fail',
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(titledDash.milestones?.[0]?.name).toBe(
      'Run check one - record the pass or fail',
    );
    expect(titledDash.milestones?.[0]?.dueDate).toBeUndefined();
  });

  it('does not invent member responsibilities', () => {
    const patch = buildLocalQuestDraftPatch({
      message: 'Ada Lovelace',
      currentStep: 'members',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.members?.[0]?.memberName).toBe('Ada Lovelace');
    expect(patch.members?.[0]?.responsibilities ?? []).toEqual([]);
    const { next } = applyPatchToQuestDraftState({
      current: emptyDraft,
      patch: {
        members: [{ memberName: 'Ada Lovelace', responsibilities: [] }],
      },
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(next.members[0]?.responsibilities).toEqual([]);
  });
});

describe('new quest helper transcript', () => {
  const hostile: QuestDraftModelTurn = {
    patch: {
      goal: 'Put in goal "Testing out the quest feature"',
      scopeIn: ['do you think that is well defined goal?'],
    },
    reply: 'Do you want that to be in the Scope?',
  };

  function send(
    message: string,
    state: {
      draft: QuestDraftStateSnapshot;
      currentStep: QuestStewardStep;
      pending: PendingQuestSectionProposal | null;
    },
    model: QuestDraftModelTurn | null = null,
    history: { role: 'user' | 'agent'; text: string }[] = [],
  ) {
    return runNewQuestDraftTurn({
      message,
      currentStep: state.currentStep,
      draft: state.draft,
      pending: state.pending,
      history,
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model,
    });
  }

  it('follows the failed /quests/new transcript without storing the instruction or the question', () => {
    expect(questDraftTurnUsesModel('goal is to test quest')).toBe(false);
    expect(
      questDraftTurnUsesModel('Put in goal "Testing out the quest feature"'),
    ).toBe(false);
    expect(
      questDraftTurnUsesModel('do you think that is well defined goal?'),
    ).toBe(false);
    expect(questDraftTurnUsesModel('yes')).toBe(false);

    const opening = send('goal is to test quest', {
      draft: emptyDraft,
      currentStep: 'goal',
      pending: null,
    });
    expect(opening.wrote).toBe(false);
    expect(opening.draft.goal).toBe('');
    expect(opening.reply).toMatch(/activity/i);
    expect(opening.reply).toMatch(/test outcome or success/i);
    expect(opening.reply).toMatch(/what behavior do you want to verify/i);
    expect(opening.reply).not.toMatch(/Do you want that to be in the Goal/i);

    const commanded = send(
      'Put in goal "Testing out the quest feature"',
      {
        draft: opening.draft,
        currentStep: 'goal',
        pending: opening.pending,
      },
      hostile,
    );
    expect(commanded.wrote).toBe(true);
    expect(commanded.draft.goal).toBe('Testing out the quest feature');
    expect(commanded.draft.scopeIn).toEqual([]);
    expect(commanded.draft.scopeOut).toEqual([]);
    expect(commanded.draft.successCriteria).toBe('');
    expect(commanded.draft.milestones).toEqual([]);
    expect(commanded.draft.members).toEqual([]);
    expect(commanded.draft.rewards).toEqual([]);
    expect(commanded.draft.targetDate).toBeNull();
    expect(commanded.pending).toBeNull();
    expect(commanded.focusStep).toBe('goal');
    expect(commanded.reply).toMatch(/Added that to the Goal/i);
    expect(commanded.reply).toMatch(/activity/i);
    expect(commanded.reply).toMatch(/test outcome or success/i);
    expect(commanded.reply).toMatch(/what behavior do you want to verify/i);
    expect(commanded.reply).not.toMatch(/Do you want that to be in the Goal/i);
    expect(commanded.reply).not.toContain(
      'Put in goal "Testing out the quest feature"',
    );

    const staleYes = send('yes', {
      draft: commanded.draft,
      currentStep: commanded.focusStep,
      pending: commanded.pending,
    });
    expect(staleYes.wrote).toBe(false);
    expect(staleYes.draft.goal).toBe('Testing out the quest feature');
    expect(staleYes.draft.scopeIn).toEqual([]);
    expect(staleYes.reply).toMatch(/Nothing is waiting on a yes/i);

    const coaching = send(
      'do you think that is well defined goal?',
      {
        draft: commanded.draft,
        currentStep: 'scope',
        pending: {
          step: 'scope',
          patch: { scopeIn: ['a stale scope proposal'] },
        },
      },
      hostile,
      [
        {
          role: 'user',
          text: 'Put in goal "Testing out the quest feature"',
        },
      ],
    );
    expect(coaching.wrote).toBe(false);
    expect(coaching.draft.goal).toBe('Testing out the quest feature');
    expect(coaching.draft.scopeIn).toEqual([]);
    expect(coaching.draft.scopeOut).toEqual([]);
    expect(coaching.pending).toBeNull();
    expect(coaching.focusStep).toBe('scope');
    expect(coaching.reply).toMatch(/activity/i);
    expect(coaching.reply).toMatch(/what behavior do you want to verify/i);
    expect(coaching.reply).not.toMatch(/Do you want that to be in the Scope/i);
    expect(coaching.reply).not.toContain(
      'do you think that is well defined goal?',
    );

    const yesAfterQuestion = send('yes', {
      draft: coaching.draft,
      currentStep: 'scope',
      pending: coaching.pending,
    });
    expect(yesAfterQuestion.wrote).toBe(false);
    expect(yesAfterQuestion.draft.scopeIn).toEqual([]);
    expect(yesAfterQuestion.draft.goal).toBe('Testing out the quest feature');
  });

  it('rejects a proposal, then applies a later explicit correction', () => {
    const proposed = send('In: sandbox checklist. Out: real payments.', {
      draft: {
        ...emptyDraft,
        goal: 'Match every new joiner to 3 spaces in their first day.',
      },
      currentStep: 'scope',
      pending: null,
    });
    expect(proposed.wrote).toBe(false);
    expect(proposed.pending?.step).toBe('scope');
    expect(proposed.pending?.patch.scopeIn).toEqual(['sandbox checklist.']);
    expect(proposed.draft.scopeIn).toEqual([]);

    const rejected = send('no', {
      draft: proposed.draft,
      currentStep: 'scope',
      pending: proposed.pending,
    });
    expect(rejected.wrote).toBe(false);
    expect(rejected.pending).toBeNull();
    expect(rejected.draft.scopeIn).toEqual([]);
    expect(rejected.reply).toMatch(/left that out/i);

    const corrected = send(
      'Change the goal to "Verify the create draft shows the goal before scope"',
      {
        draft: rejected.draft,
        currentStep: 'scope',
        pending: null,
      },
      {
        patch: {
          goal: 'Change the goal to "Verify the create draft shows the goal before scope"',
        },
      },
    );
    expect(corrected.draft.goal).toBe(
      'Verify the create draft shows the goal before scope',
    );
    expect(corrected.draft.scopeIn).toEqual([]);
    expect(corrected.reply).not.toMatch(/Do you want that to be in the Goal/i);
    expect(corrected.reply).not.toContain('Change the goal to');
  });

  it('keeps a model suggestion pending until the member accepts it', () => {
    const saved = 'Match every new joiner to 3 spaces in their first day.';
    const offline = send(
      'rewrite the goal',
      {
        draft: { ...emptyDraft, goal: saved },
        currentStep: 'goal',
        pending: null,
      },
      null,
    );
    expect(offline.wrote).toBe(false);
    expect(offline.pending).toBeNull();
    expect(offline.draft.goal).toBe(saved);
    expect(offline.reply).toMatch(/won't replace the Goal/i);

    const suggested = send(
      'rewrite the goal',
      {
        draft: { ...emptyDraft, goal: saved },
        currentStep: 'goal',
        pending: null,
      },
      {
        patch: {
          goal: 'Match every new joiner to 3 spaces before the end of their first day.',
          scopeIn: ['invented sandbox work'],
        },
      },
    );
    expect(suggested.wrote).toBe(false);
    expect(suggested.draft.goal).toBe(saved);
    expect(suggested.draft.scopeIn).toEqual([]);
    expect(suggested.pending?.step).toBe('goal');
    expect(suggested.pending?.patch.goal).toMatch(/before the end/);
    expect(suggested.pending?.patch.scopeIn).toBeUndefined();
    expect(suggested.reply).toMatch(/Suggested refinement, not saved yet/i);

    const accepted = send('yes', {
      draft: suggested.draft,
      currentStep: 'goal',
      pending: suggested.pending,
    });
    expect(accepted.wrote).toBe(true);
    expect(accepted.draft.goal).toBe(
      'Match every new joiner to 3 spaces before the end of their first day.',
    );
    expect(accepted.reply).not.toMatch(/Do you want that to be in the Goal/i);
  });

  it('fills goal, scope, success criteria, and a milestone with one confirmation each', () => {
    const goal = 'Match every new joiner to 3 spaces in their first day.';
    expect(questDraftTurnUsesModel(goal)).toBe(true);
    const proposedGoal = send(goal, {
      draft: emptyDraft,
      currentStep: 'goal',
      pending: null,
    });
    expect(proposedGoal.wrote).toBe(false);
    expect(proposedGoal.pending?.patch.goal).toBe(goal);
    expect(proposedGoal.reply).toMatch(/Do you want that to be in the Goal/i);
    expect(proposedGoal.reply).toContain(goal);

    const acceptedGoal = send('yes', {
      draft: proposedGoal.draft,
      currentStep: 'goal',
      pending: proposedGoal.pending,
    });
    expect(acceptedGoal.draft.goal).toBe(goal);
    expect(acceptedGoal.focusStep).toBe('scope');
    expect(acceptedGoal.reply).toMatch(/Added that to the Goal/i);
    expect(acceptedGoal.reply).toMatch(/in scope/i);
    expect(acceptedGoal.reply).not.toMatch(
      /Do you want that to be in the Goal/i,
    );

    const scopeMessage = 'In: sandbox checklist. Out: real payments.';
    const proposedScope = send(scopeMessage, {
      draft: acceptedGoal.draft,
      currentStep: acceptedGoal.focusStep,
      pending: null,
    });
    expect(proposedScope.wrote).toBe(false);
    expect(proposedScope.reply).toMatch(/Do you want that to be in the Scope/i);
    expect(
      proposedScope.reply.match(/Do you want that to be in the Scope/gi),
    ).toHaveLength(1);

    const acceptedScope = send('Yes, put that in the Scope.', {
      draft: proposedScope.draft,
      currentStep: 'scope',
      pending: proposedScope.pending,
    });
    expect(acceptedScope.draft.scopeIn).toEqual(['sandbox checklist.']);
    expect(acceptedScope.draft.scopeOut).toEqual(['real payments.']);
    expect(acceptedScope.focusStep).toBe('success');
    expect(acceptedScope.reply).toMatch(/Added that to the Scope/i);
    expect(acceptedScope.reply).not.toMatch(
      /Do you want that to be in the Scope/i,
    );

    const success = '60% of new members join a suggested space within 7 days';
    const proposedSuccess = send(success, {
      draft: acceptedScope.draft,
      currentStep: 'success',
      pending: null,
    });
    expect(proposedSuccess.wrote).toBe(false);
    expect(proposedSuccess.pending?.patch.successCriteriaBullets).toEqual([
      success,
    ]);
    expect(proposedSuccess.reply).toMatch(
      /Do you want that to be in the Success criteria/i,
    );

    const acceptedSuccess = send('yes', {
      draft: proposedSuccess.draft,
      currentStep: 'success',
      pending: proposedSuccess.pending,
    });
    expect(acceptedSuccess.draft.successCriteria).toContain('60%');
    expect(acceptedSuccess.focusStep).toBe('milestones');
    expect(acceptedSuccess.reply).not.toMatch(
      /Do you want that to be in the Success criteria/i,
    );

    const milestone = 'Run check one - 20 November 2026 - Ada Lovelace';
    const proposedMilestone = send(milestone, {
      draft: acceptedSuccess.draft,
      currentStep: 'milestones',
      pending: null,
    });
    expect(proposedMilestone.wrote).toBe(false);
    expect(proposedMilestone.pending?.patch.milestones?.[0]?.name).toBe(
      'Run check one',
    );
    expect(proposedMilestone.pending?.patch.milestones?.[0]?.dueDate).toBe(
      '20 November 2026',
    );
    expect(proposedMilestone.reply).toMatch(
      /Do you want that to be in the Milestones/i,
    );

    const acceptedMilestone = send('yes please', {
      draft: proposedMilestone.draft,
      currentStep: 'milestones',
      pending: proposedMilestone.pending,
    });
    expect(acceptedMilestone.draft.milestones[0]?.name).toBe('Run check one');
    expect(acceptedMilestone.draft.milestones[0]?.dueDate).toBe(
      '20 November 2026',
    );
    expect(acceptedMilestone.draft.milestones[0]?.ownerName).toBe(
      'Ada Lovelace',
    );
    expect(acceptedMilestone.draft.members).toEqual([]);
    expect(acceptedMilestone.draft.rewards).toEqual([]);
    expect(acceptedMilestone.draft.targetDate).toBeNull();
    expect(acceptedMilestone.reply).not.toMatch(
      /Do you want that to be in the Milestones/i,
    );
  });

  it('still coaches a section opener and does not write it', () => {
    const coached = send("Now let's define the scope", {
      draft: {
        ...emptyDraft,
        goal: 'Match every new joiner to 3 spaces in their first day.',
      },
      currentStep: 'goal',
      pending: { step: 'goal', patch: { goal: 'a stale goal proposal' } },
    });
    expect(coached.wrote).toBe(false);
    expect(coached.pending).toBeNull();
    expect(coached.focusStep).toBe('scope');
    expect(coached.draft.scopeIn).toEqual([]);
    expect(coached.draft.goal).toMatch(/Match every new joiner/);
    expect(coached.reply).not.toMatch(/Do you want that to be in the Scope/i);
  });

  it('extracts a quoted command in the local parser and drops questions', () => {
    expect(
      buildLocalQuestDraftPatch({
        message: 'Put in goal "Testing out the quest feature"',
        currentStep: 'scope',
        draft: emptyDraft,
        viewerDisplayName: 'Vlad Hramtsov',
      }),
    ).toEqual({ goal: 'Testing out the quest feature' });
    expect(
      buildLocalQuestDraftPatch({
        message: 'do you think that is well defined goal?',
        currentStep: 'scope',
        draft: emptyDraft,
        viewerDisplayName: 'Vlad Hramtsov',
      }),
    ).toEqual({});
    expect(
      buildLocalQuestDraftPatch({
        message: 'yes',
        currentStep: 'scope',
        draft: emptyDraft,
        viewerDisplayName: 'Vlad Hramtsov',
      }),
    ).toEqual({});
  });
});
