import { describe, expect, it } from 'vitest';
import {
  isBulkQuestDraftRequest,
  questPendingYesNotice,
  resolveQuestDraftTarget,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import {
  applyPatchToQuestDraftState,
  buildLocalQuestDraftPatch,
  decideNewQuestDraftTurn,
  explicitQuestSectionCommand,
  findNextUnfilledQuestStep,
  formatPendingQuestPatch,
  isQuestSectionApproval,
  isQuestSectionCoachingOpener,
  QUEST_HELPER_OFFLINE_REPLY,
  questDraftSuggestionStatus,
  questDraftTurnUsesModel,
  questHelperTurnMessage,
  replyWithSectionApprovalAsk,
  runNewQuestDraftTurn,
  settleCreateDraftTurn,
  stripQuestMetaInstructions,
  type CreateDraftTurnSnapshot,
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
  it('does not treat a conversational goal sentence as a local patch', () => {
    const patch = buildLocalQuestDraftPatch({
      message: 'We want to build an onboarding matcher for new joiners.',
      currentStep: 'goal',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch).toEqual({});
    const { next, updatedLabels } = applyPatchToQuestDraftState({
      current: emptyDraft,
      patch: {
        goal: 'We want to build an onboarding matcher for new joiners.',
      },
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
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
      commandPayload: true,
    });
    expect(hyphenated.milestones?.[0]?.name).toBe(
      'Ship the on-chain checklist',
    );
    const titledDash = buildLocalQuestDraftPatch({
      message: 'Run check one - record the pass or fail',
      currentStep: 'milestones',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
      commandPayload: true,
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
      commandPayload: true,
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
    expect(questDraftTurnUsesModel('goal is to test quest')).toBe(true);
    expect(
      questDraftTurnUsesModel('Put in goal "Testing out the quest feature"'),
    ).toBe(false);
    expect(
      questDraftTurnUsesModel('do you think that is well defined goal?'),
    ).toBe(true);
    expect(questDraftTurnUsesModel('yes')).toBe(false);

    const offlineOpening = send('goal is to test quest', {
      draft: emptyDraft,
      currentStep: 'goal',
      pending: null,
    });
    expect(offlineOpening.wrote).toBe(false);
    expect(offlineOpening.draft.goal).toBe('');
    expect(offlineOpening.pending).toBeNull();
    expect(offlineOpening.reply).toBe(QUEST_HELPER_OFFLINE_REPLY);

    const opening = send(
      'goal is to test quest',
      {
        draft: emptyDraft,
        currentStep: 'goal',
        pending: null,
      },
      {
        reply:
          'That names an activity. Who is this for, and what should be true when the test passes?',
        patch: {
          goal: 'goal is to test quest',
          rewards: [{ amount: '10', token: 'USDC' }],
        },
      },
    );
    expect(opening.wrote).toBe(false);
    expect(opening.draft.goal).toBe('');
    expect(opening.draft.rewards).toEqual([]);
    expect(opening.pending).toBeNull();
    expect(opening.reply).toMatch(/who is this for/i);
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
    expect(coaching.reply).toBe(QUEST_HELPER_OFFLINE_REPLY);
    expect(coaching.reply).not.toMatch(/Do you want that to be in the Scope/i);
    expect(coaching.reply).not.toContain(
      'do you think that is well defined goal?',
    );

    const assessed = send(
      'do you think that is well defined goal?',
      {
        draft: commanded.draft,
        currentStep: 'scope',
        pending: {
          step: 'scope',
          patch: { scopeIn: ['a stale scope proposal'] },
        },
      },
      {
        reply:
          'The accepted goal names the feature, but not who it is for or what done looks like.',
        patch: {
          scopeIn: ['do you think that is well defined goal?'],
          goal: 'do you think that is well defined goal?',
        },
      },
      [
        {
          role: 'user',
          text: 'Put in goal "Testing out the quest feature"',
        },
      ],
    );
    expect(assessed.wrote).toBe(false);
    expect(assessed.pending).toBeNull();
    expect(assessed.draft.goal).toBe('Testing out the quest feature');
    expect(assessed.draft.scopeIn).toEqual([]);
    expect(assessed.focusStep).toBe('scope');
    expect(assessed.reply).toMatch(/who it is for/i);

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
    const proposedGoal = send(
      goal,
      {
        draft: emptyDraft,
        currentStep: 'goal',
        pending: null,
      },
      {
        reply:
          'That outcome is a suggestion and is not saved until you confirm.',
        patch: { goal, scopeIn: ['not this section'] },
      },
    );
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
    const proposedSuccess = send(
      success,
      {
        draft: acceptedScope.draft,
        currentStep: 'success',
        pending: null,
      },
      {
        reply: 'One check, not saved until you confirm.',
        patch: { successCriteriaBullets: [success], rewards: [] },
      },
    );
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
    const proposedMilestone = send(
      milestone,
      {
        draft: acceptedSuccess.draft,
        currentStep: 'milestones',
        pending: null,
      },
      {
        reply: 'One checkpoint, not saved until you confirm.',
        patch: {
          milestones: [
            {
              name: 'Run check one',
              dueDate: '20 November 2026',
              description: 'Run check one',
              ownerName: 'Ada Lovelace',
            },
          ],
          goal: 'replaced',
        },
      },
    );
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
    expect(coached.reply).toBe(QUEST_HELPER_OFFLINE_REPLY);
    expect(coached.reply).not.toMatch(/Do you want that to be in the Scope/i);

    const guided = send(
      "Now let's define the scope",
      {
        draft: {
          ...emptyDraft,
          goal: 'Match every new joiner to 3 spaces in their first day.',
        },
        currentStep: 'goal',
        pending: null,
      },
      {
        reply:
          'Scope is the boundary. What is the one thing this quest must ship?',
        patch: { scopeIn: ['invented sandbox work'] },
      },
    );
    expect(guided.wrote).toBe(false);
    expect(guided.pending).toBeNull();
    expect(guided.focusStep).toBe('scope');
    expect(guided.draft.scopeIn).toEqual([]);
    expect(guided.reply).toMatch(/one thing this quest must ship/i);
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

describe('quest helper command and rewrite boundaries', () => {
  const savedGoal = 'Match every new joiner to 3 spaces in their first day.';

  function send(
    message: string,
    state: {
      draft: QuestDraftStateSnapshot;
      currentStep: QuestStewardStep;
      pending: PendingQuestSectionProposal | null;
    },
    model: QuestDraftModelTurn | null = null,
  ) {
    return runNewQuestDraftTurn({
      message,
      currentStep: state.currentStep,
      draft: state.draft,
      pending: state.pending,
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model,
    });
  }

  it('keeps ordinary member and success wording in the current section', () => {
    const state = {
      draft: { ...emptyDraft, goal: savedGoal },
      currentStep: 'goal' as const,
      pending: null,
    };
    for (const message of [
      'We update members on progress every week',
      'Write success stories for new joiners',
    ]) {
      const turn = send(message, state, {
        reply: 'Noted.',
        patch: {
          members: [
            { memberName: 'Ada Lovelace', responsibilities: ['Updates'] },
          ],
          successCriteriaBullets: ['Stories published'],
        },
      });
      expect(turn.focusStep).toBe('goal');
      expect(turn.pending?.step ?? 'goal').toBe('goal');
      expect(turn.draft.members).toEqual([]);
      expect(turn.draft.successCriteria).toBe('');
      expect(turn.wrote).toBe(false);
    }
    expect(send('Update the members', state, null).focusStep).not.toBe('goal');
    expect(send('Write the success criteria', state, null).focusStep).toBe(
      'success',
    );
  });

  it('asks the model to improve a named section and keeps the accepted goal until yes', () => {
    expect(questDraftTurnUsesModel('improve the goal')).toBe(true);
    expect(questDraftTurnUsesModel('goal is to test quest')).toBe(true);
    expect(questDraftTurnUsesModel('improve onboarding for new members')).toBe(
      true,
    );

    const idea = send(
      'improve onboarding for new members',
      {
        draft: {
          ...emptyDraft,
          goal: savedGoal,
          leadName: 'Ada Lovelace',
        },
        currentStep: 'goal',
        pending: null,
      },
      {
        reply: 'Onboarding is the activity. Who is it for, and what changes?',
        patch: {
          leadName: 'the CRM',
          goal: 'improve onboarding for new members',
        },
      },
    );
    expect(idea.wrote).toBe(false);
    expect(idea.draft.goal).toBe(savedGoal);
    expect(idea.draft.leadName).toBe('Ada Lovelace');
    expect(idea.pending).toBeNull();
    expect(idea.focusStep).toBe('goal');
    expect(idea.reply).toMatch(/who is it for/i);

    const offline = send('improve the goal', {
      draft: { ...emptyDraft, goal: savedGoal, scopeIn: ['saved scope'] },
      currentStep: 'scope',
      pending: null,
    });
    expect(offline.wrote).toBe(false);
    expect(offline.draft.goal).toBe(savedGoal);
    expect(offline.draft.scopeIn).toEqual(['saved scope']);
    expect(offline.pending).toBeNull();
    expect(offline.focusStep).toBe('goal');
    expect(offline.reply).toMatch(/won't replace the Goal/i);

    const suggested = send(
      'improve the goal',
      {
        draft: { ...emptyDraft, goal: savedGoal, scopeIn: ['saved scope'] },
        currentStep: 'scope',
        pending: null,
      },
      {
        patch: {
          goal: 'Match every new joiner to 3 spaces before the first day ends.',
          scopeIn: ['invented sandbox work'],
        },
        reply: 'Do you want that to be in the Goal?',
      },
    );
    expect(suggested.wrote).toBe(false);
    expect(suggested.draft.goal).toBe(savedGoal);
    expect(suggested.draft.scopeIn).toEqual(['saved scope']);
    expect(suggested.pending?.step).toBe('goal');
    expect(suggested.pending?.patch.goal).toMatch(/before the first day ends/);
    expect(suggested.pending?.patch.scopeIn).toBeUndefined();
    expect(suggested.reply).toMatch(/Suggested refinement, not saved yet/i);

    const accepted = send('yes', {
      draft: suggested.draft,
      currentStep: 'goal',
      pending: suggested.pending,
    });
    expect(accepted.wrote).toBe(true);
    expect(accepted.draft.goal).toMatch(/before the first day ends/);
    expect(accepted.draft.scopeIn).toEqual(['saved scope']);
  });

  it('keeps quoted commands and does not treat a later to as the lead', () => {
    expect(
      explicitQuestSectionCommand(
        'Put in goal "Testing out the quest feature"',
      ),
    ).toEqual({
      step: 'goal',
      content: 'Testing out the quest feature',
    });
    expect(
      explicitQuestSectionCommand(
        'Change the goal to "Verify the create draft shows the goal before scope"',
      ),
    ).toEqual({
      step: 'goal',
      content: 'Verify the create draft shows the goal before scope',
    });
    expect(
      explicitQuestSectionCommand('Please set the scope to sandbox checklist.'),
    ).toEqual({ step: 'scope', content: 'sandbox checklist' });
    expect(
      explicitQuestSectionCommand('Set the scope: sandbox checklist'),
    ).toEqual({ step: 'scope', content: 'sandbox checklist' });
    expect(
      explicitQuestSectionCommand('Add lead scoring to the CRM'),
    ).toBeNull();

    const prose = send(
      'Add lead scoring to the CRM',
      {
        draft: {
          ...emptyDraft,
          goal: savedGoal,
          leadName: 'Ada Lovelace',
        },
        currentStep: 'success',
        pending: null,
      },
      { patch: { leadName: 'the CRM', goal: 'replaced by the model' } },
    );
    expect(prose.wrote).toBe(false);
    expect(prose.draft.goal).toBe(savedGoal);
    expect(prose.draft.leadName).toBe('Ada Lovelace');
    expect(prose.draft.rewards).toEqual([]);
    expect(prose.pending).toBeNull();
    expect(prose.reply).not.toMatch(/Not saved yet/i);
    expect(prose.reply).not.toContain('Add lead scoring to the CRM');

    const coached = send('Members use rewards within 7 days', {
      draft: { ...emptyDraft, goal: savedGoal },
      currentStep: 'success',
      pending: null,
    });
    expect(coached.wrote).toBe(false);
    expect(coached.focusStep).toBe('success');
    expect(coached.draft.goal).toBe(savedGoal);
    expect(coached.draft.rewards).toEqual([]);
    expect(coached.pending).toBeNull();
    expect(coached.reply).not.toMatch(/Not saved yet/i);
    expect(coached.reply).not.toContain('Members use rewards within 7 days');
  });
});

describe('create draft turn settles against the latest snapshot', () => {
  const manualMilestone = {
    name: 'Manual milestone',
    description: 'Added in the modal',
    dueDate: '20 November 2026',
    ownerName: 'Ada Lovelace',
    status: 'not_started' as const,
  };

  it('applies a deferred model turn onto edits made while the fetch was in flight', async () => {
    let resolveModel: (value: QuestDraftModelTurn | null) => void = () => {};
    const gate = new Promise<QuestDraftModelTurn | null>((resolve) => {
      resolveModel = resolve;
    });
    let loaded = false;
    const state: CreateDraftTurnSnapshot = {
      draft: {
        ...emptyDraft,
        goal: 'Match every new joiner to 3 spaces in their first day.',
        scopeIn: ['saved scope'],
      },
      pending: { step: 'scope', patch: { scopeIn: ['stale proposal'] } },
      currentStep: 'scope',
    };
    const generation = 1;
    const pendingResult = settleCreateDraftTurn({
      message: 'improve the goal',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => generation === 1,
      loadModel: () => {
        loaded = true;
        return gate;
      },
    });

    state.draft = {
      ...state.draft,
      goal: 'Edited in the modal while the helper was thinking.',
      milestones: [manualMilestone],
    };
    state.pending = {
      step: 'success',
      patch: { successCriteriaBullets: ['manual pending'] },
    };
    state.currentStep = 'success';
    resolveModel({
      patch: {
        goal: 'Match every new joiner to 3 spaces before the first day ends.',
        scopeIn: ['invented by the model'],
        milestones: [{ name: 'Model milestone' }],
      },
      reply: 'Do you want that to be in the Goal?',
    });

    const result = await pendingResult;
    expect(loaded).toBe(true);
    expect(result).not.toBeNull();
    expect(result?.wrote).toBe(false);
    expect(result?.draft.goal).toBe(
      'Edited in the modal while the helper was thinking.',
    );
    expect(result?.draft.scopeIn).toEqual(['saved scope']);
    expect(result?.draft.milestones).toEqual([manualMilestone]);
    expect(result?.pending?.step).toBe('goal');
    expect(result?.pending?.patch.goal).toMatch(/before the first day ends/);
    expect(result?.pending?.patch.scopeIn).toBeUndefined();
    expect(result?.pending?.patch.milestones).toBeUndefined();
    expect(result?.focusStep).toBe('goal');
    expect(result?.reply).toMatch(/Suggested refinement, not saved yet/i);
  });

  it('drops a model turn that a later send superseded', async () => {
    let resolveModel: (value: QuestDraftModelTurn | null) => void = () => {};
    const gate = new Promise<QuestDraftModelTurn | null>((resolve) => {
      resolveModel = resolve;
    });
    const state: CreateDraftTurnSnapshot = {
      draft: {
        ...emptyDraft,
        goal: 'Match every new joiner to 3 spaces in their first day.',
      },
      pending: null,
      currentStep: 'goal',
    };
    let generation = 1;
    const pendingResult = settleCreateDraftTurn({
      message: 'improve the goal',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => generation === 1,
      loadModel: () => gate,
    });

    generation = 2;
    state.draft = { ...state.draft, goal: 'Kept by the newer turn' };
    state.pending = { step: 'goal', patch: { goal: 'newer pending' } };
    resolveModel({
      patch: { goal: 'stale model goal', scopeIn: ['stale scope'] },
    });

    expect(await pendingResult).toBeNull();
    expect(state.draft.goal).toBe('Kept by the newer turn');
    expect(state.pending?.patch.goal).toBe('newer pending');
    expect(state.draft.scopeIn).toEqual([]);
  });

  it('writes an explicit command from the latest draft and does not fetch a model', async () => {
    let loaded = false;
    const state: CreateDraftTurnSnapshot = {
      draft: {
        ...emptyDraft,
        scopeIn: ['keep me'],
        milestones: [manualMilestone],
        leadName: 'Ada Lovelace',
      },
      pending: { step: 'scope', patch: { scopeIn: ['not this'] } },
      currentStep: 'scope',
    };
    const result = await settleCreateDraftTurn({
      message: 'Put in goal "Testing out the quest feature"',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => true,
      loadModel: async () => {
        loaded = true;
        return {
          patch: { goal: 'Put in goal "Testing out the quest feature"' },
        };
      },
    });
    expect(loaded).toBe(false);
    expect(result?.wrote).toBe(true);
    expect(result?.draft.goal).toBe('Testing out the quest feature');
    expect(result?.draft.scopeIn).toEqual(['keep me']);
    expect(result?.draft.milestones).toEqual([manualMilestone]);
    expect(result?.draft.leadName).toBe('Ada Lovelace');
    expect(result?.pending).toBeNull();
  });

  it('follows a vague goal through assessment, confirmation, rejection, and an offline model', async () => {
    const calls: string[] = [];
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft },
      pending: null,
      currentStep: 'goal',
    };
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [
          {
            role: 'user',
            text: 'Put in goal "Testing out the quest feature"',
          },
        ],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const opening = await settle('goal is to test quest', {
      reply:
        'That is an activity. Who should be able to tell the quest worked?',
      patch: {
        goal: 'goal is to test quest',
        rewards: [{ amount: '2500', token: 'USDC' }],
      },
    });
    expect(calls).toEqual(['goal is to test quest']);
    expect(opening?.wrote).toBe(false);
    expect(opening?.draft.goal).toBe('');
    expect(opening?.draft.rewards).toEqual([]);
    expect(opening?.pending).toBeNull();
    expect(opening?.reply).toMatch(/who should be able to tell/i);

    const concrete =
      'Members can tell a new quest draft kept the goal they confirmed.';
    const polished =
      'Members can tell that a new quest draft kept the goal they confirmed.';
    const unspoken = await settle(concrete, {
      reply: 'That names a check a reviewer can see.',
      patch: null,
    });
    expect(unspoken?.wrote).toBe(false);
    expect(unspoken?.pending).toBeNull();
    expect(unspoken?.draft.goal).toBe('');
    expect(unspoken?.reply).not.toMatch(/Not saved yet/i);
    expect(unspoken?.reply).not.toContain(concrete);

    const proposed = await settle(concrete, {
      reply: 'That names a check a reviewer can see.',
      patch: { goal: polished },
    });
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.pending?.patch.goal).toBe(polished);
    expect(proposed?.reply).toContain(polished);
    expect(proposed?.reply).not.toContain(concrete);
    expect(proposed?.reply).toMatch(/reviewer can see/);
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.draft.goal).toBe('');

    state.pending = proposed?.pending ?? null;
    const accepted = await settle('yes', null);
    expect(calls).not.toContain('yes');
    expect(accepted?.wrote).toBe(true);
    expect(accepted?.draft.goal).toBe(polished);
    state.draft = accepted?.draft ?? state.draft;
    state.pending = null;
    state.currentStep = accepted?.focusStep ?? 'goal';

    const assessment = await settle('do you think that is well defined goal?', {
      reply:
        'It says who can tell and what they look at. It does not name a number.',
      patch: {
        goal: 'do you think that is well defined goal?',
        scopeIn: ['nope'],
      },
    });
    expect(assessment?.wrote).toBe(false);
    expect(assessment?.pending).toBeNull();
    expect(assessment?.draft.goal).toBe(polished);
    expect(assessment?.draft.scopeIn).toEqual([]);
    expect(assessment?.reply).toMatch(/does not name a number/);

    const refine = await settle('rewrite the goal', {
      reply: 'A tighter line, still your facts.',
      patch: {
        goal: 'A member can tell the confirmed goal stayed on the draft.',
        scopeIn: ['invented'],
      },
    });
    expect(refine?.wrote).toBe(false);
    expect(refine?.draft.goal).toBe(polished);
    expect(refine?.pending?.step).toBe('goal');
    expect(refine?.pending?.patch.scopeIn).toBeUndefined();
    expect(refine?.pending?.patch.goal).toMatch(/confirmed goal stayed/);

    state.pending = refine?.pending ?? null;
    const rejected = await settle('no', null);
    expect(calls).not.toContain('no');
    expect(rejected?.pending).toBeNull();
    expect(rejected?.draft.goal).toBe(polished);
    state.pending = null;

    const cross = await settle('what reward should we pay?', {
      reply: 'Rewards are a later section. Nothing here names an amount.',
      patch: {
        rewards: [{ amount: '2500', token: 'USDC' }],
        scopeIn: ['x'],
      },
    });
    expect(cross?.wrote).toBe(false);
    expect(cross?.pending).toBeNull();
    expect(cross?.draft.rewards).toEqual([]);
    expect(cross?.draft.goal).toBe(polished);
    expect(cross?.reply).toMatch(/nothing here names an amount/i);

    const failed = await settleCreateDraftTurn({
      message: 'how should we scope this?',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => true,
      loadModel: async () => {
        throw new Error('offline');
      },
    });
    expect(failed?.reply).toBe(QUEST_HELPER_OFFLINE_REPLY);
    expect(failed?.wrote).toBe(false);
    expect(failed?.pending).toBeNull();
    expect(failed?.draft.goal).toBe(polished);
  });

  it('does not file a sentence the model is still clarifying', async () => {
    const savedGoal = 'Match every new joiner to 3 spaces in their first day.';
    const keptScope = ['keep the checklist'];
    const clarification =
      'Do you mean the Lead role, or the work of adding lead scoring? What outcome should voters be able to check?';
    const state: CreateDraftTurnSnapshot = {
      draft: {
        ...emptyDraft,
        goal: savedGoal,
        leadName: 'Ada Lovelace',
        scopeIn: keptScope,
      },
      pending: null,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const malicious = {
      leadName: 'scoring',
      scopeIn: ['Add lead scoring'],
      goal: 'replaced',
      rewards: [{ amount: '7', token: 'USDC' }],
    };
    for (const patch of [malicious, {}]) {
      const clarified = await settle('Add lead scoring', {
        reply: clarification,
        patch,
      });
      expect(clarified?.wrote).toBe(false);
      expect(clarified?.pending).toBeNull();
      expect(clarified?.draft.goal).toBe(savedGoal);
      expect(clarified?.draft.leadName).toBe('Ada Lovelace');
      expect(clarified?.draft.scopeIn).toEqual(keptScope);
      expect(clarified?.draft.rewards).toEqual([]);
      expect(clarified?.reply).toBe(clarification);
      expect(clarified?.reply).not.toMatch(/Not saved yet/i);
      expect(clarified?.reply).not.toMatch(/Do you want that to be in/i);
    }

    const rewards = await settle('Members use rewards within 7 days', {
      reply: 'That names a Quest Reward, not Scope.',
      patch: {
        scopeIn: ['Members use rewards within 7 days'],
        rewards: [{ amount: '7', token: 'DAYS' }],
        leadName: 'Members',
      },
    });
    expect(rewards?.wrote).toBe(false);
    expect(rewards?.pending).toBeNull();
    expect(rewards?.draft.scopeIn).toEqual(keptScope);
    expect(rewards?.draft.rewards).toEqual([]);
    expect(rewards?.draft.leadName).toBe('Ada Lovelace');
    expect(rewards?.reply).toMatch(/Quest Reward, not Scope/);
    expect(rewards?.reply).not.toMatch(/Not saved yet/i);

    const concrete = 'Ship the sandbox checklist to every new member.';
    const polishedScope = 'Publish the sandbox checklist for every new member.';
    const proposed = await settle(concrete, {
      reply: 'That is one deliverable voters can point at.',
      patch: {
        scopeIn: [polishedScope],
        leadName: 'checklist',
        rewards: [{ amount: '1', token: 'USDC' }],
      },
    });
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.draft.scopeIn).toEqual(keptScope);
    expect(proposed?.draft.leadName).toBe('Ada Lovelace');
    expect(proposed?.pending?.step).toBe('scope');
    expect(proposed?.pending?.patch.scopeIn).toEqual([polishedScope]);
    expect(proposed?.pending?.patch.scopeIn).not.toContain(concrete);
    expect(proposed?.pending?.patch.leadName).toBeUndefined();
    expect(proposed?.pending?.patch.rewards).toBeUndefined();
    expect(proposed?.reply).toContain(polishedScope);
    expect(proposed?.reply).not.toContain(concrete);
    expect(proposed?.reply).toMatch(/voters can point at/);
    expect(proposed?.reply).toMatch(/Not saved yet/);

    const waiting = {
      step: 'goal' as const,
      patch: { goal: 'A reviewer can tell the confirmed goal stayed.' },
    };
    state.pending = waiting;
    const duringPending = await settle('Add lead scoring', {
      reply: clarification,
      patch: malicious,
    });
    expect(duringPending?.wrote).toBe(false);
    expect(duringPending?.pending).toEqual(waiting);
    expect(duringPending?.draft.goal).toBe(savedGoal);
    expect(duringPending?.draft.scopeIn).toEqual(keptScope);
    expect(duringPending?.reply).toBe(
      `${clarification}\n\n${questPendingYesNotice('goal')}`,
    );

    const question = await settle('what reward should we pay?', {
      reply: 'Rewards are a later section. Nothing here names an amount.',
      patch: {
        rewards: [{ amount: '2500', token: 'USDC' }],
        scopeIn: ['what reward should we pay?'],
        goal: 'replaced',
      },
    });
    expect(question?.wrote).toBe(false);
    expect(question?.pending).toBeNull();
    expect(question?.pending?.patch.scopeIn).toBeUndefined();
    expect(question?.pending?.patch.rewards).toBeUndefined();
    expect(question?.pending?.patch.goal).toBeUndefined();
    expect(question?.draft.goal).toBe(savedGoal);
    expect(question?.draft.scopeIn).toEqual(keptScope);
    expect(question?.draft.rewards).toEqual([]);
    expect(question?.reply).toMatch(/nothing here names an amount/i);
    expect(question?.reply).not.toMatch(/Not saved yet/i);

    state.pending = question?.pending ?? null;
    const accepted = await settle('yes', null);
    expect(calls).not.toContain('yes');
    expect(accepted?.wrote).toBe(false);
    expect(accepted?.draft.goal).toBe(savedGoal);
    expect(accepted?.draft.scopeIn).toEqual(keptScope);
    expect(accepted?.reply).toMatch(/Nothing is waiting on a yes/i);

    state.draft = accepted?.draft ?? state.draft;
    state.pending = { step: 'scope', patch: { scopeIn: ['not this'] } };
    state.currentStep = 'scope';
    let quotedLoaded = false;
    const quoted = await settleCreateDraftTurn({
      message: 'Put in scope "Add lead scoring"',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => true,
      loadModel: async () => {
        quotedLoaded = true;
        return { patch: { leadName: 'scoring', scopeIn: ['invented'] } };
      },
    });
    expect(quotedLoaded).toBe(false);
    expect(quoted?.wrote).toBe(true);
    expect(quoted?.pending).toBeNull();
    expect(quoted?.draft.scopeIn).toEqual(['Add lead scoring']);
    expect(quoted?.draft.leadName).toBe('Ada Lovelace');
    expect(quoted?.draft.goal).toBe(savedGoal);
    expect(calls).toEqual([
      'Add lead scoring',
      'Add lead scoring',
      'Members use rewards within 7 days',
      concrete,
      'Add lead scoring',
      'what reward should we pay?',
    ]);
  });

  it('does not invite yes after a question retires a pending suggestion', async () => {
    const savedGoal = 'Match every new joiner to 3 spaces in their first day.';
    const state: CreateDraftTurnSnapshot = {
      draft: {
        ...emptyDraft,
        goal: savedGoal,
        leadName: 'Ada Lovelace',
        scopeIn: [],
      },
      pending: {
        step: 'scope',
        patch: {
          scopeIn: ['Ship the sandbox checklist to every new member.'],
        },
      },
      currentStep: 'scope',
    };
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [
          {
            role: 'agent',
            text: 'Not saved yet.\nIn:\n• Ship the sandbox checklist to every new member.\n\nDo you want that to be in the Scope?',
          },
        ],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => model,
      });

    const question = await settle('what reward should we pay?', {
      reply:
        "Rewards are a later section. Nothing here names an amount. A reviewer could confirm the outcome from the member list. The two lines above are still a suggestion and aren't saved until you confirm them.",
      patch: {
        scopeIn: ['what reward should we pay?'],
        rewards: [{ amount: '2500', token: 'USDC' }],
        goal: 'replaced',
      },
    });
    expect(question?.wrote).toBe(false);
    expect(question?.pending).toBeNull();
    expect(question?.draft.goal).toBe(savedGoal);
    expect(question?.draft.leadName).toBe('Ada Lovelace');
    expect(question?.draft.scopeIn).toEqual([]);
    expect(question?.draft.rewards).toEqual([]);
    expect(question?.reply).toMatch(/Nothing here names an amount/);
    expect(question?.reply).toMatch(/reviewer could confirm the outcome/);
    expect(question?.reply).toMatch(/no longer waiting on a yes/i);
    expect(question?.reply).not.toMatch(/until you confirm/i);
    expect(question?.reply).not.toMatch(/still a suggestion/i);
    expect(question?.reply).not.toMatch(/Not saved yet/i);

    state.pending = question?.pending ?? null;
    const yes = await settle('yes', {
      reply:
        'The two lines above are still a suggestion. Say yes to save them.',
      patch: { scopeIn: ['Ship the sandbox checklist to every new member.'] },
    });
    expect(yes?.wrote).toBe(false);
    expect(yes?.pending).toBeNull();
    expect(yes?.draft.scopeIn).toEqual([]);
    expect(yes?.draft.goal).toBe(savedGoal);
    expect(yes?.reply).toMatch(/Nothing is waiting on a yes/i);
    expect(yes?.reply).not.toMatch(/still a suggestion/i);
  });

  it('files a grounded scope proposal and leaves prose-only confirmation in chat', async () => {
    const boundaries =
      'In scope: verify proposal display and milestone editing in sandbox; out of scope: production rollout.';
    const requested = `Please propose these exact scope boundaries for my confirmation: ${boundaries}`;
    const readyReply =
      'That boundary is a suggestion and is not saved until you confirm. Should I add that to the Scope?';
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, scopeIn: [], scopeOut: [] },
      pending: null,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const concrete = await settle(boundaries, {
      reply: readyReply,
      patch: {
        scopeIn: ['invented'],
        goal: 'replaced',
        leadName: 'scoring',
      },
    });
    expect(concrete?.wrote).toBe(false);
    expect(concrete?.draft.scopeIn).toEqual([]);
    expect(concrete?.draft.scopeOut).toEqual([]);
    expect(concrete?.draft.goal).toBe('');
    expect(concrete?.pending?.step).toBe('scope');
    expect(concrete?.pending?.patch.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(concrete?.pending?.patch.scopeOut).toEqual(['production rollout.']);
    expect(concrete?.pending?.patch.goal).toBeUndefined();
    expect(concrete?.pending?.patch.leadName).toBeUndefined();
    expect(concrete?.reply).toMatch(/Not saved yet/);
    expect(concrete?.reply).toMatch(/Do you want that to be in the Scope\?/);
    expect(
      concrete?.reply.match(/Do you want that to be in the Scope/gi),
    ).toHaveLength(1);
    expect(concrete?.reply).not.toMatch(/one section at a time/i);

    const proposed = await settle(requested, {
      reply:
        "We'll take one section at a time. What's in scope, and what's explicitly out of scope? This is not saved until you confirm.",
      patch: {},
    });
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.reply).not.toMatch(/^We'll take one section at a time/);
    expect(proposed?.pending?.step).toBe('scope');
    expect(proposed?.pending?.patch.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(proposed?.pending?.patch.scopeOut).toEqual(['production rollout.']);
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.reply).toMatch(/Do you want that to be in the Scope\?/);
    expect(proposed?.draft.scopeIn).toEqual([]);

    const checklist = 'Ship the sandbox checklist to every new member.';
    const approved = await settle(checklist, {
      reply: 'That is one deliverable. Should I add that to the Scope?',
      patch: { scopeIn: ['invented scope'], leadName: 'checklist' },
    });
    expect(approved?.wrote).toBe(false);
    expect(approved?.pending?.step).toBe('scope');
    expect(approved?.pending?.patch.scopeIn).toEqual(['invented scope']);
    expect(approved?.pending?.patch.leadName).toBeUndefined();
    expect(approved?.reply).toContain('invented scope');
    expect(approved?.reply).not.toContain(checklist);
    expect(approved?.reply).toMatch(/one deliverable/);
    expect(approved?.reply).toMatch(/Not saved yet/);
    expect(approved?.reply).toMatch(/Do you want that to be in the Scope\?/);
    expect(approved?.draft.scopeIn).toEqual([]);

    const clarification =
      'Do you mean the Lead role, or the work of adding lead scoring? What outcome should voters be able to check?';
    const prose =
      "I'll treat those words as a suggestion. They aren't saved until you confirm.";
    for (const patch of [
      {},
      {
        scopeIn: ['Add lead scoring'],
        leadName: 'scoring',
        goal: 'replaced',
      },
    ]) {
      const clarified = await settle('Add lead scoring', {
        reply: `${prose} ${clarification}`,
        patch,
      });
      expect(clarified?.wrote).toBe(false);
      expect(clarified?.pending).toBeNull();
      expect(clarified?.draft.scopeIn).toEqual([]);
      expect(clarified?.draft.leadName).toBe(emptyDraft.leadName);
      expect(clarified?.draft.goal).toBe('');
      expect(clarified?.reply).toMatch(/Do you mean the Lead role/);
      expect(clarified?.reply).not.toMatch(/until you confirm/i);
      expect(clarified?.reply).not.toMatch(/Not saved yet/i);
      expect(clarified?.reply).not.toMatch(/Do you want that to be in/i);
      expect(clarified?.reply).toMatch(/Nothing is waiting on a yes/i);
    }

    const fabricated = await settle("now let's define the scope", {
      reply:
        'Here is a suggestion for the sandbox work. It is not saved until you confirm. Do you want that to be in the Scope?',
      patch: { scopeIn: ['invented sandbox work'], goal: 'replaced' },
    });
    expect(calls).toContain("now let's define the scope");
    expect(fabricated?.wrote).toBe(false);
    expect(fabricated?.pending).toBeNull();
    expect(fabricated?.draft.scopeIn).toEqual([]);
    expect(fabricated?.draft.goal).toBe('');
    expect(fabricated?.reply).not.toMatch(/until you confirm/i);
    expect(fabricated?.reply).not.toMatch(/Not saved yet/i);
    expect(fabricated?.reply).not.toMatch(/Do you want that to be in/i);
    expect(fabricated?.reply).not.toMatch(/invented sandbox work/);

    state.pending = concrete?.pending ?? null;
    const question = await settle('what reward should we pay?', {
      reply:
        "Rewards are a later section. Nothing here names an amount. A reviewer could confirm the outcome from the member list. The earlier suggestion isn't saved until you confirm it.",
      patch: {
        rewards: [{ amount: '2500', token: 'USDC' }],
        scopeIn: ['what reward should we pay?'],
      },
    });
    expect(question?.wrote).toBe(false);
    expect(question?.pending).toBeNull();
    expect(question?.draft.scopeIn).toEqual([]);
    expect(question?.draft.scopeOut).toEqual([]);
    expect(question?.draft.rewards).toEqual([]);
    expect(question?.reply).toMatch(/Nothing here names an amount/);
    expect(question?.reply).toMatch(/reviewer could confirm the outcome/);
    expect(question?.reply).toMatch(/no longer waiting on a yes/i);
    expect(question?.reply).not.toMatch(/until you confirm/i);
    expect(question?.reply).not.toMatch(/Not saved yet/i);

    state.pending = null;
    const yes = await settle('yes', {
      reply: 'Say yes to save the earlier suggestion.',
      patch: concrete?.pending?.patch ?? { scopeIn: ['invented'] },
    });
    expect(calls).not.toContain('yes');
    expect(yes?.wrote).toBe(false);
    expect(yes?.pending).toBeNull();
    expect(yes?.draft.scopeIn).toEqual([]);
    expect(yes?.reply).toMatch(/Nothing is waiting on a yes/i);

    let quotedLoaded = false;
    const quoted = await settleCreateDraftTurn({
      message:
        'Put in scope "verify proposal display and milestone editing in sandbox"',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => true,
      loadModel: async () => {
        quotedLoaded = true;
        return { patch: { scopeIn: ['invented'], goal: 'replaced' } };
      },
    });
    expect(quotedLoaded).toBe(false);
    expect(quoted?.wrote).toBe(true);
    expect(quoted?.pending).toBeNull();
    expect(quoted?.draft.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(quoted?.draft.goal).toBe('');
    state.draft = quoted?.draft ?? state.draft;
    state.pending = null;

    const bulk = await settle(
      'Draft the scope, success criteria, and milestones.',
      {
        reply: 'I drafted all three.',
        patch: {
          scopeIn: ['invented'],
          successCriteriaBullets: ['a check'],
          milestones: [{ name: 'M1' }],
        },
      },
    );
    expect(bulk?.wrote).toBe(false);
    expect(bulk?.pending).toBeNull();
    expect(bulk?.reply).toMatch(/one section at a time/i);
    expect(bulk?.draft.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
  });

  it('files the unpunctuated request to propose scope boundaries', async () => {
    const requested =
      'Please propose these exact scope boundaries for my confirmation: in scope verify proposal display and milestone editing in sandbox; out of scope production rollout.';
    const entered = questHelperTurnMessage(`  @Quest Helper ${requested}`);
    expect(questHelperTurnMessage(requested)).toBe(requested);
    expect(entered).toBe(requested);
    expect(isBulkQuestDraftRequest(entered)).toBe(false);
    expect(questDraftTurnUsesModel(entered)).toBe(true);
    expect(resolveQuestDraftTarget(entered, 'scope')).toEqual({
      step: 'scope',
      bulk: false,
    });

    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, scopeIn: [], scopeOut: [], milestones: [] },
      pending: null,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message: questHelperTurnMessage(message),
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const proposed = await settle(entered, {
      reply:
        "We'll take one section at a time. What's in scope, and what's explicitly out of scope?",
      patch: {
        goal: 'replaced',
        milestones: [{ name: 'Edit milestones' }],
        scopeIn: ['wrong'],
        scopeOut: ['wrong'],
      },
    });
    expect(calls).toEqual([entered]);
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.focusStep).toBe('scope');
    expect(proposed?.draft.scopeIn).toEqual([]);
    expect(proposed?.draft.scopeOut).toEqual([]);
    expect(proposed?.draft.goal).toBe('');
    expect(proposed?.draft.milestones).toEqual([]);
    expect(proposed?.pending?.step).toBe('scope');
    expect(proposed?.pending?.patch.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(proposed?.pending?.patch.scopeOut).toEqual(['production rollout']);
    expect(proposed?.pending?.patch.goal).toBeUndefined();
    expect(proposed?.pending?.patch.milestones).toBeUndefined();
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.reply).toMatch(/Do you want that to be in the Scope\?/);
    expect(proposed?.reply).not.toMatch(/^We'll take one section at a time/);

    const several =
      'Draft the scope, success criteria, and milestones. in scope verify proposal display and milestone editing in sandbox; out of scope production rollout.';
    const bulk = await settle(several, {
      reply: 'I drafted all three.',
      patch: {
        scopeIn: ['invented'],
        successCriteriaBullets: ['a check'],
        milestones: [{ name: 'M1' }],
      },
    });
    expect(calls).toEqual([entered]);
    expect(questDraftTurnUsesModel(several)).toBe(false);
    expect(bulk?.wrote).toBe(false);
    expect(bulk?.pending).toBeNull();
    expect(bulk?.draft).toEqual(state.draft);
    expect(bulk?.reply).toBe(
      "We'll take one section at a time. What's in scope, and what's explicitly out of scope?",
    );

    const clarified = await settle('Add lead scoring', {
      reply:
        'Do you mean the Lead role, or the work of adding lead scoring? What outcome should voters be able to check?',
      patch: {
        scopeIn: ['Add lead scoring'],
        leadName: 'scoring',
        goal: 'replaced',
      },
    });
    expect(clarified?.wrote).toBe(false);
    expect(clarified?.pending).toBeNull();
    expect(clarified?.draft.scopeIn).toEqual([]);
    expect(clarified?.draft.goal).toBe('');
    expect(clarified?.reply).toMatch(/Do you mean the Lead role/);
    expect(clarified?.reply).not.toMatch(/Not saved yet/i);
    expect(clarified?.reply).not.toMatch(/Do you want that to be in/i);
  });

  it('routes a labeled scope line off a vague goal', () => {
    const labeled = runNewQuestDraftTurn({
      message: 'In scope: testing the checklist',
      currentStep: 'goal',
      draft: emptyDraft,
      pending: null,
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model: {
        reply:
          '“testing the checklist” gives an activity, but it does not say what the test outcome means.',
        patch: { goal: 'testing the checklist', scopeIn: ['invented'] },
      },
    });
    expect(labeled.wrote).toBe(false);
    expect(labeled.focusStep).toBe('scope');
    expect(labeled.draft.goal).toBe('');
    expect(labeled.draft.scopeIn).toEqual([]);
    expect(labeled.pending?.step).toBe('scope');
    expect(labeled.pending?.patch.goal).toBeUndefined();
    expect(labeled.pending?.patch.scopeIn).toEqual(['testing the checklist']);
    expect(labeled.reply).toMatch(/Not saved yet/);
    expect(labeled.reply).toMatch(/Do you want that to be in the Scope/);

    const vague = runNewQuestDraftTurn({
      message: 'testing the checklist',
      currentStep: 'goal',
      draft: emptyDraft,
      pending: null,
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model: {
        reply: 'Who is this for, and what should be true when the test passes?',
        patch: { goal: 'testing the checklist' },
      },
    });
    expect(vague.focusStep).toBe('goal');
    expect(vague.pending).toBeNull();
    expect(vague.draft.goal).toBe('');
    expect(vague.draft.scopeIn).toEqual([]);
    expect(vague.reply).toMatch(/who is this for/i);
    expect(vague.reply).not.toMatch(/Do you want that to be in the Scope/i);
  });

  it('keeps a quoted section command, a colon bulk ask, and an older pending patch distinct', async () => {
    const exact =
      'Please propose these exact scope boundaries for my confirmation: in scope verify proposal display and milestone editing in sandbox; out of scope production rollout.';
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] },
      pending: null,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message: questHelperTurnMessage(message),
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const proposed = await settle(exact, {
      reply:
        "We'll take one section at a time. What's in scope, and what's explicitly out of scope?",
      patch: {
        goal: 'replaced',
        milestones: [{ name: 'Edit milestones' }],
        scopeIn: ['wrong'],
      },
    });
    expect(calls).toEqual([exact]);
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.pending?.step).toBe('scope');
    expect(proposed?.pending?.patch.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(proposed?.pending?.patch.scopeOut).toEqual(['production rollout']);
    expect(proposed?.pending?.patch.goal).toBeUndefined();
    expect(proposed?.draft.scopeIn).toEqual([]);
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.reply).toMatch(/Do you want that to be in the Scope\?/);

    state.pending = proposed?.pending ?? null;
    const saved = await settle('yes', {
      reply: 'Saved lead scoring into the scope.',
      patch: { scopeIn: ['Add lead scoring'], goal: 'replaced' },
    });
    expect(calls).toEqual([exact]);
    expect(saved?.wrote).toBe(true);
    expect(saved?.pending).toBeNull();
    expect(saved?.draft.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(saved?.draft.scopeOut).toEqual(['production rollout']);
    expect(saved?.draft.goal).toBe('');
    expect(saved?.reply).toMatch(/Added that to the Scope/);

    state.draft = { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] };
    state.pending = {
      step: 'scope',
      patch: {
        scopeIn: ['verify proposal display and milestone editing in sandbox'],
        scopeOut: ['production rollout'],
      },
    };
    state.currentStep = 'scope';
    const goalQuestion = await settle('what should the goal be?', {
      reply:
        "I'll treat that as the goal. It isn't saved until you confirm. Who is the goal for?",
      patch: {
        goal: 'what should the goal be?',
        scopeIn: ['replaced scope'],
      },
    });
    expect(goalQuestion?.wrote).toBe(false);
    expect(goalQuestion?.pending).toBeNull();
    expect(goalQuestion?.draft.goal).toBe('');
    expect(goalQuestion?.draft.scopeIn).toEqual([]);
    expect(goalQuestion?.reply).toMatch(/Who is the goal for/);
    expect(goalQuestion?.reply).toMatch(/no longer waiting on a yes/i);
    expect(goalQuestion?.reply).not.toMatch(/until you confirm/i);
    expect(goalQuestion?.reply).not.toMatch(/Not saved yet/i);
    state.pending = null;
    const yesAfterQuestion = await settle('yes', {
      reply: 'Say yes to save the goal.',
      patch: { goal: 'what should the goal be?', scopeIn: ['replaced scope'] },
    });
    expect(yesAfterQuestion?.wrote).toBe(false);
    expect(yesAfterQuestion?.pending).toBeNull();
    expect(yesAfterQuestion?.draft.goal).toBe('');
    expect(yesAfterQuestion?.draft.scopeIn).toEqual([]);
    expect(yesAfterQuestion?.reply).toMatch(/Nothing is waiting on a yes/i);

    state.pending = {
      step: 'scope',
      patch: {
        scopeIn: ['verify proposal display and milestone editing in sandbox'],
        scopeOut: ['production rollout'],
      },
    };
    const clarified = await settle('Add lead scoring', {
      reply:
        "I'll treat those words as a suggestion. They aren't saved until you confirm. Do you mean the Lead role, or the work of adding lead scoring?",
      patch: {
        scopeIn: ['Add lead scoring'],
        leadName: 'scoring',
        goal: 'replaced',
      },
    });
    expect(clarified?.wrote).toBe(false);
    expect(clarified?.pending?.step).toBe('scope');
    expect(clarified?.pending?.patch.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(clarified?.pending?.patch.scopeOut).toEqual(['production rollout']);
    expect(clarified?.pending?.patch.leadName).toBeUndefined();
    expect(clarified?.draft.scopeIn).toEqual([]);
    expect(clarified?.draft.goal).toBe('');
    expect(clarified?.draft.leadName).toBe(emptyDraft.leadName);
    expect(clarified?.reply).toMatch(/Do you mean the Lead role/);
    expect(clarified?.reply).toMatch(
      /The Scope suggestion is still waiting on a yes/,
    );
    expect(clarified?.reply).not.toMatch(/until you confirm/i);
    expect(clarified?.reply).not.toMatch(/as a suggestion/i);
    expect(clarified?.reply).not.toMatch(/Nothing is waiting on a yes/i);
    expect(clarified?.reply).not.toMatch(/Not saved yet/i);
    expect(clarified?.reply).not.toMatch(/Add lead scoring/);

    state.pending = clarified?.pending ?? null;
    const yesScope = await settle('yes', {
      reply: 'Saved the lead scoring.',
      patch: { scopeIn: ['Add lead scoring'], leadName: 'scoring' },
    });
    expect(yesScope?.wrote).toBe(true);
    expect(yesScope?.pending).toBeNull();
    expect(yesScope?.draft.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(yesScope?.draft.scopeOut).toEqual(['production rollout']);
    expect(yesScope?.draft.leadName).toBe(emptyDraft.leadName);
    expect(yesScope?.draft.goal).toBe('');

    state.draft = {
      ...emptyDraft,
      goal: 'Keep this goal',
      scopeIn: [],
      scopeOut: [],
    };
    state.pending = null;
    state.currentStep = 'goal';
    const quoted = await settle(
      'Set the scope to "write all onboarding docs"',
      {
        reply: 'I drafted every section.',
        patch: {
          goal: 'replaced',
          scopeIn: ['invented'],
          milestones: [{ name: 'Write everything' }],
        },
      },
    );
    expect(calls).not.toContain('Set the scope to "write all onboarding docs"');
    expect(quoted?.wrote).toBe(true);
    expect(quoted?.pending).toBeNull();
    expect(quoted?.draft.scopeIn).toEqual(['write all onboarding docs']);
    expect(quoted?.draft.goal).toBe('Keep this goal');
    expect(quoted?.draft.milestones).toEqual([]);
    expect(quoted?.reply).toMatch(/Added that to the Scope/);

    state.draft = quoted?.draft ?? state.draft;
    state.pending = null;
    state.currentStep = 'scope';
    const colonBulk = await settle(
      'Draft the scope, success criteria, and milestones. In scope: verify proposal display and milestone editing in sandbox. Out of scope: production rollout.',
      {
        reply: 'I drafted all three.',
        patch: {
          scopeIn: ['invented'],
          successCriteriaBullets: ['a check'],
          milestones: [{ name: 'M1' }],
        },
      },
    );
    expect(colonBulk?.wrote).toBe(false);
    expect(colonBulk?.pending).toBeNull();
    expect(colonBulk?.draft.scopeIn).toEqual(['write all onboarding docs']);
    expect(colonBulk?.draft.goal).toBe('Keep this goal');
    expect(colonBulk?.reply).toBe(
      "We'll take one section at a time. What's in scope, and what's explicitly out of scope?",
    );
    expect(calls).not.toContain(
      'Draft the scope, success criteria, and milestones. In scope: verify proposal display and milestone editing in sandbox. Out of scope: production rollout.',
    );
  });

  it('strips unbacked confirm claims while an older section is still pending', () => {
    const pending = {
      step: 'goal' as const,
      patch: { goal: 'A reviewer can tell the confirmed goal stayed.' },
    };
    const result = runNewQuestDraftTurn({
      message: 'Add lead scoring',
      currentStep: 'scope',
      draft: { ...emptyDraft, goal: 'saved' },
      pending,
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model: {
        reply:
          'Do you mean the Lead role? That is not saved until you confirm it.',
        patch: { leadName: 'scoring' },
      },
    });
    expect(result.wrote).toBe(false);
    expect(result.pending).toEqual(pending);
    expect(result.reply).toMatch(/Do you mean the Lead role/);
    expect(result.reply).not.toMatch(/not saved until you confirm/i);
    expect(result.reply).toMatch(
      /The Goal suggestion is still waiting on a yes/,
    );
    expect(result.reply).not.toMatch(/Nothing is waiting on a yes/);
  });

  it('names the preserved scope when the model calls that suggestion history', async () => {
    const historyReply =
      'The earlier in/out wording stays history until we settle this.';
    const clarification =
      'Do you mean the Lead role, or the work of adding lead scoring?';
    const scopePending: PendingQuestSectionProposal = {
      step: 'scope',
      patch: {
        scopeIn: ['verify proposal display and milestone editing in sandbox'],
        scopeOut: ['production rollout'],
      },
    };
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] },
      pending: scopePending,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });
    const expectNoticeOnce = (reply: string | undefined, notice: string) => {
      const parts = (reply ?? '').split(notice);
      expect(parts).toHaveLength(2);
      expect(parts[1]?.trim()).toBe('');
    };

    expect(
      questDraftSuggestionStatus('Add lead scoring', scopePending),
    ).toEqual({ status: 'awaiting', step: 'scope' });
    expect(
      questDraftSuggestionStatus('what should the goal be?', scopePending),
    ).toEqual({ status: 'retired', step: 'scope' });
    expect(questDraftSuggestionStatus('Add lead scoring', null)).toEqual({
      status: 'none',
    });

    const contradicted = await settle('Add lead scoring', {
      reply: historyReply,
      patch: {
        scopeIn: ['Add lead scoring'],
        leadName: 'scoring',
        goal: 'replaced',
      },
    });
    expect(contradicted?.wrote).toBe(false);
    expect(contradicted?.pending).toEqual(scopePending);
    expect(contradicted?.draft.scopeIn).toEqual([]);
    expect(contradicted?.draft.scopeOut).toEqual([]);
    expect(contradicted?.draft.goal).toBe('');
    expect(contradicted?.draft.leadName).toBe(emptyDraft.leadName);
    expect(contradicted?.reply).toContain(historyReply);
    expectNoticeOnce(contradicted?.reply, questPendingYesNotice('scope'));
    expect(contradicted?.reply).toMatch(
      /Yes applies that Scope suggestion and nothing else/,
    );
    expect(contradicted?.reply).not.toMatch(/Nothing is waiting on a yes/i);
    expect(contradicted?.reply).not.toMatch(/Not saved yet/i);

    state.pending = contradicted?.pending ?? null;
    const yesScope = await settle('yes', {
      reply: 'Saved the lead scoring.',
      patch: {
        scopeIn: ['Add lead scoring'],
        leadName: 'scoring',
        goal: 'replaced',
      },
    });
    expect(calls).not.toContain('yes');
    expect(yesScope?.wrote).toBe(true);
    expect(yesScope?.pending).toBeNull();
    expect(yesScope?.draft.scopeIn).toEqual([
      'verify proposal display and milestone editing in sandbox',
    ]);
    expect(yesScope?.draft.scopeOut).toEqual(['production rollout']);
    expect(yesScope?.draft.leadName).toBe(emptyDraft.leadName);
    expect(yesScope?.draft.goal).toBe('');

    state.draft = { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] };
    state.pending = scopePending;
    const plain = await settle('Add lead scoring', {
      reply: clarification,
      patch: { scopeIn: ['Add lead scoring'], leadName: 'scoring' },
    });
    expect(plain?.wrote).toBe(false);
    expect(plain?.pending).toEqual(scopePending);
    expect(plain?.draft.scopeIn).toEqual([]);
    expect(plain?.reply).toContain(clarification);
    expectNoticeOnce(plain?.reply, questPendingYesNotice('scope'));
    expect(plain?.reply).not.toMatch(/Nothing is waiting on a yes/i);

    state.pending = plain?.pending ?? null;
    const echoed = await settle('Add lead scoring', {
      reply: `${clarification}\n\n${questPendingYesNotice('scope')}`,
      patch: { scopeIn: ['Add lead scoring'] },
    });
    expect(echoed?.pending).toEqual(scopePending);
    expect(echoed?.reply).toContain(clarification);
    expectNoticeOnce(echoed?.reply, questPendingYesNotice('scope'));

    state.pending = scopePending;
    state.draft = { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] };
    const question = await settle('what should the goal be?', {
      reply: historyReply,
      patch: {
        goal: 'what should the goal be?',
        scopeIn: ['replaced scope'],
      },
    });
    expect(question?.wrote).toBe(false);
    expect(question?.pending).toBeNull();
    expect(question?.draft.goal).toBe('');
    expect(question?.draft.scopeIn).toEqual([]);
    expect(question?.reply).toContain(historyReply);
    expect(question?.reply).not.toMatch(/still waiting on a yes/i);
    expect(question?.reply).not.toMatch(/Yes applies that Scope suggestion/i);

    state.pending = null;
    const yesAfterQuestion = await settle('yes', {
      reply: 'Say yes to save the goal.',
      patch: {
        goal: 'what should the goal be?',
        scopeIn: ['Add lead scoring'],
      },
    });
    expect(calls).not.toContain('yes');
    expect(yesAfterQuestion?.wrote).toBe(false);
    expect(yesAfterQuestion?.pending).toBeNull();
    expect(yesAfterQuestion?.draft.goal).toBe('');
    expect(yesAfterQuestion?.draft.scopeIn).toEqual([]);
    expect(yesAfterQuestion?.reply).toMatch(/Nothing is waiting on a yes/i);
  });

  it('saves the structured model proposal instead of the raw acceptance', async () => {
    const rawAcceptance =
      'yes that a quest published end-to-end in this space with a named lead and a reward';
    const polishedGoal =
      'Publish one quest end-to-end in this sandbox space — with a named lead and a reward attached — so we can confirm the quest creation flow works from goal through publication.';
    const scopeIn = ['Sandbox editor', 'Proposal page'];
    const scopeOut = ['Production rollout'];
    const success = [
      'The published quest can be opened',
      'It has a lead and a reward',
    ];
    const revisedGoal =
      'Publish one quest end-to-end in this sandbox space, with a named lead and a reward, so the creation flow can be checked.';
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, goal: '', scopeIn: [], scopeOut: [] },
      pending: null,
      currentStep: 'goal',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    const coached = await settle('goal is to test quest creation', {
      reply:
        '"Test quest creation" names an activity, not an outcome — a reviewer can\'t check whether it happened. Who is this for (just you, or someone new to the sandbox), and what should be true when it\'s done — e.g. a quest published end-to-end in this space with a named lead and a reward?',
      patch: {
        goal: 'goal is to test quest creation',
        rewards: [{ amount: '1', token: 'USDC' }],
      },
    });
    expect(coached?.wrote).toBe(false);
    expect(coached?.pending).toBeNull();
    expect(coached?.draft.goal).toBe('');
    expect(coached?.reply).toMatch(/who is this for/i);
    expect(coached?.reply).not.toMatch(/Not saved yet/i);

    const proposed = await settle(rawAcceptance, {
      reply: [
        "That's your outcome, written as one suggestion — it is not saved until you confirm it:",
        polishedGoal,
        'A reviewer can check it: the quest exists, has a lead, and has a reward.',
        'If you\'d rather it be "just you" or "someone new to the sandbox" as the beneficiary, say so and I\'ll tighten it.',
        "Otherwise, confirm and we'll move to Scope.",
      ].join('\n'),
      patch: {
        goal: polishedGoal,
        scopeIn: ['should not stick'],
        rewards: [{ amount: '9', token: 'USDC' }],
      },
    });
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.pending?.step).toBe('goal');
    expect(proposed?.pending?.patch.goal).toBe(polishedGoal);
    expect(proposed?.pending?.patch.scopeIn).toBeUndefined();
    expect(proposed?.pending?.patch.rewards).toBeUndefined();
    expect(proposed?.draft.goal).toBe('');
    expect(proposed?.reply).toContain(polishedGoal);
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.reply).toMatch(/Do you want that to be in the Goal/);
    expect(proposed?.reply).not.toContain(rawAcceptance);

    state.pending = proposed?.pending ?? null;
    const savedGoal = await settle('yes', {
      reply: 'Saved the raw sentence.',
      patch: { goal: rawAcceptance },
    });
    expect(calls).not.toContain('yes');
    expect(savedGoal?.wrote).toBe(true);
    expect(savedGoal?.pending).toBeNull();
    expect(savedGoal?.draft.goal).toBe(polishedGoal);
    expect(savedGoal?.draft.goal).not.toContain('yes that');

    state.draft = savedGoal?.draft ?? state.draft;
    state.pending = null;
    state.currentStep = 'scope';
    const scope = await settle(
      'cover the sandbox editor and the proposal page, and leave production out',
      {
        reply:
          'That boundary is one suggestion and is not saved until you confirm.',
        patch: {
          scopeIn,
          scopeOut,
          goal: 'replaced goal',
        },
      },
    );
    expect(scope?.wrote).toBe(false);
    expect(scope?.pending?.step).toBe('scope');
    expect(scope?.pending?.patch.scopeIn).toEqual(scopeIn);
    expect(scope?.pending?.patch.scopeOut).toEqual(scopeOut);
    expect(scope?.pending?.patch.goal).toBeUndefined();
    expect(scope?.draft.goal).toBe(polishedGoal);
    expect(scope?.draft.scopeIn).toEqual([]);
    expect(scope?.reply).toContain('Sandbox editor');
    expect(scope?.reply).toContain('Production rollout');
    expect(scope?.reply).not.toContain('leave production out');

    state.pending = scope?.pending ?? null;
    const savedScope = await settle('yes', null);
    expect(savedScope?.wrote).toBe(true);
    expect(savedScope?.draft.scopeIn).toEqual(scopeIn);
    expect(savedScope?.draft.scopeOut).toEqual(scopeOut);
    expect(savedScope?.draft.goal).toBe(polishedGoal);

    state.draft = savedScope?.draft ?? state.draft;
    state.pending = null;
    state.currentStep = 'success';
    const criteria = await settle('a reviewer can open the published quest', {
      reply:
        'These checks are a suggestion and are not saved until you confirm.',
      patch: {
        successCriteriaBullets: success,
        goal: 'replaced again',
      },
    });
    expect(criteria?.pending?.step).toBe('success');
    expect(criteria?.pending?.patch.successCriteriaBullets).toEqual(success);
    expect(criteria?.pending?.patch.goal).toBeUndefined();
    expect(criteria?.reply).toContain('The published quest can be opened');
    expect(criteria?.reply).not.toContain(
      'a reviewer can open the published quest',
    );
    state.pending = criteria?.pending ?? null;
    const savedSuccess = await settle('yes', null);
    expect(savedSuccess?.draft.successCriteria).toContain(
      'The published quest can be opened',
    );
    expect(savedSuccess?.draft.goal).toBe(polishedGoal);

    state.draft = savedSuccess?.draft ?? state.draft;
    state.pending = null;
    const question = await settle('what reward should we pay?', {
      reply: 'Rewards are a later section. Nothing here names an amount.',
      patch: { rewards: [{ amount: '2500', token: 'USDC' }] },
    });
    expect(question?.pending).toBeNull();
    expect(question?.draft.rewards).toEqual([]);
    expect(question?.reply).not.toMatch(/Not saved yet/i);

    const clarified = await settle('Add lead scoring', {
      reply:
        'Do you mean the Lead role, or the work of adding lead scoring? What outcome should voters be able to check?',
      patch: { scopeIn: ['Add lead scoring'], leadName: 'scoring' },
    });
    expect(clarified?.pending).toBeNull();
    expect(clarified?.draft.scopeIn).toEqual(scopeIn);
    expect(clarified?.reply).not.toMatch(/Not saved yet/i);

    state.currentStep = 'goal';
    const replacement = await settle('make the goal shorter', {
      reply: 'A shorter suggestion, still not saved until you confirm.',
      patch: { goal: revisedGoal },
    });
    expect(replacement?.pending?.patch.goal).toBe(revisedGoal);
    expect(replacement?.draft.goal).toBe(polishedGoal);
    state.pending = replacement?.pending ?? null;
    const rejected = await settle('no', null);
    expect(calls).not.toContain('no');
    expect(rejected?.pending).toBeNull();
    expect(rejected?.draft.goal).toBe(polishedGoal);

    state.pending = null;
    const again = await settle('use the shorter goal', {
      reply:
        'The shorter line is a suggestion and is not saved until you confirm.',
      patch: { goal: revisedGoal, scopeIn: ['nope'] },
    });
    expect(again?.pending?.patch.goal).toBe(revisedGoal);
    expect(again?.pending?.patch.scopeIn).toBeUndefined();
    state.pending = again?.pending ?? null;
    const savedRevision = await settle('yes', null);
    expect(savedRevision?.draft.goal).toBe(revisedGoal);
    expect(savedRevision?.draft.scopeIn).toEqual(scopeIn);

    state.draft = savedRevision?.draft ?? state.draft;
    state.pending = {
      step: 'scope',
      patch: { scopeIn: ['older scope'], scopeOut: ['older out'] },
    };
    state.currentStep = 'scope';
    const retired = await settle('what should the goal be?', {
      reply: 'The earlier in/out wording stays history until we settle this.',
      patch: { goal: 'what should the goal be?', scopeIn: ['replaced scope'] },
    });
    expect(retired?.pending).toBeNull();
    expect(retired?.draft.scopeIn).toEqual(scopeIn);
    expect(retired?.reply).not.toMatch(/still waiting on a yes/i);
    state.pending = null;
    const yesAfter = await settle('yes', {
      reply: 'Saved it.',
      patch: { scopeIn: ['replaced scope'] },
    });
    expect(yesAfter?.wrote).toBe(false);
    expect(yesAfter?.draft.scopeIn).toEqual(scopeIn);
    expect(yesAfter?.reply).toMatch(/Nothing is waiting on a yes/i);

    state.pending = null;
    const failed = await settleCreateDraftTurn({
      message: 'describe the sandbox outcome again',
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => state,
      isCurrent: () => true,
      loadModel: async () => {
        throw new Error('offline');
      },
    });
    expect(failed?.reply).toBe(QUEST_HELPER_OFFLINE_REPLY);
    expect(failed?.wrote).toBe(false);
    expect(failed?.pending).toBeNull();
    expect(failed?.draft.goal).toBe(revisedGoal);
    expect(failed?.draft.scopeIn).toEqual(scopeIn);
  });

  it('stores an embedded abbreviation as one goal command', async () => {
    const message = 'Set the goal to include "e.g." then write all docs';
    expect(isBulkQuestDraftRequest(message)).toBe(false);
    expect(explicitQuestSectionCommand(message)).toEqual({
      step: 'goal',
      content: 'include "e.g." then write all docs',
    });
    expect(questDraftTurnUsesModel(message)).toBe(false);
    const calls: string[] = [];
    const saved = await settleCreateDraftTurn({
      message,
      history: [],
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      readState: () => ({
        draft: { ...emptyDraft, goal: '' },
        pending: {
          step: 'scope',
          patch: { scopeIn: ['older scope'] },
        },
        currentStep: 'scope',
      }),
      isCurrent: () => true,
      loadModel: async () => {
        calls.push(message);
        return { reply: 'Draft every section.', patch: { scopeIn: ['nope'] } };
      },
    });
    expect(calls).toEqual([]);
    expect(saved?.wrote).toBe(true);
    expect(saved?.pending).toBeNull();
    expect(saved?.draft.goal).toBe('include "e.g." then write all docs');
    expect(saved?.draft.scopeIn).toEqual([]);
    expect(saved?.reply).toMatch(/Added that to the Goal/);
    expect(saved?.reply).not.toMatch(/one section at a time/i);

    const milestonesNotice = questPendingYesNotice('milestones');
    const kept = runNewQuestDraftTurn({
      message: 'Add lead scoring',
      currentStep: 'milestones',
      draft: emptyDraft,
      pending: {
        step: 'milestones',
        patch: { milestones: [{ name: 'Run check one' }] },
      },
      viewerDisplayName: 'Vlad Hramtsov',
      spaceMembers: [],
      model: {
        reply: `${milestonesNotice}\n\nDo you mean the owner?`,
        patch: { leadName: 'scoring' },
      },
    });
    const parts = kept.reply.split(milestonesNotice);
    expect(parts).toHaveLength(2);
    expect(parts[1]?.trim()).toBe('');
    expect(kept.reply).toMatch(/Do you mean the owner/);
    expect(kept.reply).toMatch(
      /Yes applies that Milestones suggestion and nothing else/,
    );
    expect(kept.reply).not.toMatch(/The Milestones is still/);
    expect(kept.pending?.step).toBe('milestones');
  });

  it('proposes a revised goal and one success section without saving the raw message', async () => {
    const accepted =
      'Publish one quest end-to-end in this sandbox space — with a named lead and a reward attached — so we can confirm the quest creation flow works from goal through publication.';
    const shorter =
      'Publish one quest end-to-end in this sandbox space, with a named lead and a reward, so the creation flow can be checked.';
    const refined =
      'Prove a quest can be published end-to-end in this space, with a named lead and a reward.';
    const proposeGoal =
      'Please propose a shorter version of the goal for my confirmation';
    const shorterStill = 'no, make it shorter still and drop the word sandbox';
    const successRequest =
      'Please propose these success criteria for my confirmation: each in-scope check is recorded with an explicit pass or fail; the lead reviews the notes.';
    const successProse =
      'Success means every listed scope check is recorded with an explicit pass or fail, and the notes are reviewed by the lead.';
    const successBullets = [
      'Every listed scope check has a recorded pass or fail',
      'The lead reviews those notes',
    ];
    const state: CreateDraftTurnSnapshot = {
      draft: { ...emptyDraft, goal: accepted },
      pending: null,
      currentStep: 'scope',
    };
    const calls: string[] = [];
    const settle = (message: string, model: QuestDraftModelTurn | null) =>
      settleCreateDraftTurn({
        message,
        history: [],
        viewerDisplayName: 'Vlad Hramtsov',
        spaceMembers: [],
        readState: () => state,
        isCurrent: () => true,
        loadModel: async () => {
          calls.push(message);
          return model;
        },
      });

    expect(
      questDraftSuggestionStatus(proposeGoal, {
        step: 'goal',
        patch: { goal: accepted },
      }),
    ).toEqual({ status: 'revising', step: 'goal' });
    expect(
      questDraftSuggestionStatus(shorterStill, {
        step: 'goal',
        patch: { goal: shorter },
      }),
    ).toEqual({ status: 'revising', step: 'goal' });
    expect(
      questDraftSuggestionStatus('Add lead scoring', {
        step: 'scope',
        patch: { scopeIn: ['older scope'] },
      }),
    ).toEqual({ status: 'awaiting', step: 'scope' });

    const refused = await settle(proposeGoal, {
      reply: 'Use Put in goal "..." if you want a different goal.',
      patch: null,
    });
    expect(refused?.wrote).toBe(false);
    expect(refused?.pending).toBeNull();
    expect(refused?.draft.goal).toBe(accepted);
    expect(refused?.reply).not.toMatch(/Not saved yet/i);

    const proposed = await settle(proposeGoal, {
      reply:
        'A shorter goal, for your confirmation. It is not saved until you confirm.',
      patch: {
        goal: shorter,
        scopeIn: ['should not stick'],
        rewards: [{ amount: '1', token: 'USDC' }],
      },
    });
    expect(proposed?.wrote).toBe(false);
    expect(proposed?.focusStep).toBe('goal');
    expect(proposed?.pending?.step).toBe('goal');
    expect(proposed?.pending?.patch.goal).toBe(shorter);
    expect(proposed?.pending?.patch.scopeIn).toBeUndefined();
    expect(proposed?.draft.goal).toBe(accepted);
    expect(proposed?.reply).toContain(shorter);
    expect(proposed?.reply).toMatch(/Not saved yet/);
    expect(proposed?.reply).toMatch(/Do you want that to be in the Goal/);
    expect(proposed?.reply).not.toContain(proposeGoal);
    expect(proposed?.reply).not.toMatch(/Put in goal/i);

    state.pending = proposed?.pending ?? null;
    state.currentStep = 'scope';
    const again = await settle(shorterStill, {
      reply:
        'Shorter still, and without sandbox. It is not saved until you confirm.',
      patch: { goal: refined, scopeOut: ['nope'] },
    });
    expect(again?.wrote).toBe(false);
    expect(again?.pending?.patch.goal).toBe(refined);
    expect(again?.pending?.patch.scopeOut).toBeUndefined();
    expect(again?.draft.goal).toBe(accepted);
    expect(again?.reply).toContain(refined);
    expect(again?.reply).not.toContain(shorterStill);

    state.pending = again?.pending ?? null;
    const saved = await settle('yes', {
      reply: 'Saved the raw no.',
      patch: { goal: shorterStill },
    });
    expect(calls).not.toContain('yes');
    expect(saved?.wrote).toBe(true);
    expect(saved?.pending).toBeNull();
    expect(saved?.draft.goal).toBe(refined);

    state.draft = { ...emptyDraft, goal: accepted };
    state.pending = { step: 'goal', patch: { goal: shorter } };
    state.currentStep = 'scope';
    const proseOnly = await settle(shorterStill, {
      reply: refined,
      patch: null,
    });
    expect(proseOnly?.wrote).toBe(false);
    expect(proseOnly?.pending).toBeNull();
    expect(proseOnly?.draft.goal).toBe(accepted);
    expect(proseOnly?.reply).not.toMatch(/Not saved yet/i);
    state.pending = proseOnly?.pending ?? null;
    const yesAfterProse = await settle('yes', {
      reply: 'Saved the prose.',
      patch: { goal: refined },
    });
    expect(yesAfterProse?.wrote).toBe(false);
    expect(yesAfterProse?.draft.goal).toBe(accepted);
    expect(yesAfterProse?.reply).toMatch(/Nothing is waiting on a yes/i);

    state.pending = null;
    const several = 'Please propose shorter versions of the goal and the scope';
    expect(questDraftTurnUsesModel(several)).toBe(false);
    const bulk = await settle(several, {
      reply: 'Here are both.',
      patch: { goal: 'x', scopeIn: ['y'] },
    });
    expect(calls).not.toContain(several);
    expect(bulk?.wrote).toBe(false);
    expect(bulk?.pending).toBeNull();
    expect(bulk?.draft.goal).toBe(accepted);
    expect(bulk?.reply).toMatch(/one section at a time/i);

    const assessed = await settle('do you think the goal is well defined?', {
      reply: 'The accepted goal names an outcome a reviewer can check.',
      patch: { goal: 'do you think the goal is well defined?' },
    });
    expect(assessed?.pending).toBeNull();
    expect(assessed?.draft.goal).toBe(accepted);
    expect(assessed?.reply).toMatch(/reviewer can check/i);
    expect(assessed?.reply).not.toMatch(/Not saved yet/i);

    state.currentStep = 'success';
    state.pending = null;
    const chatOnly = await settle(successProse, {
      reply: [
        "Here's a success criteria suggestion based on what you gave.",
        '- Each in-scope check (proposal display, milestone editing) is recorded with an explicit pass or fail',
        '- The recorded notes are reviewed by the lead',
        'Anything else a reviewer should be able to check, or is that the full set?',
        'Not saved until you confirm.',
      ].join('\n'),
      patch: null,
    });
    expect(chatOnly?.wrote).toBe(false);
    expect(chatOnly?.pending).toBeNull();
    expect(chatOnly?.draft.successCriteria).toBe('');
    expect(chatOnly?.draft.goal).toBe(accepted);
    expect(chatOnly?.reply).toContain(
      'Each in-scope check (proposal display, milestone editing)',
    );
    expect(chatOnly?.reply).toMatch(/Nothing is waiting on a yes/i);
    expect(chatOnly?.reply).not.toMatch(/Not saved yet/i);
    expect(chatOnly?.reply).not.toContain(successProse);

    state.pending = null;
    const filed = await settle(successProse, {
      reply:
        'These two checks are a suggestion. Anything else a reviewer should be able to check, or is that the full set? It is not saved until you confirm.',
      patch: {
        successCriteriaBullets: successBullets,
        goal: successProse,
        scopeIn: ['should not stick'],
      },
    });
    expect(filed?.wrote).toBe(false);
    expect(filed?.pending?.step).toBe('success');
    expect(filed?.pending?.patch.successCriteriaBullets).toEqual(
      successBullets,
    );
    expect(filed?.pending?.patch.goal).toBeUndefined();
    expect(filed?.draft.successCriteria).toBe('');
    expect(filed?.draft.goal).toBe(accepted);
    expect(filed?.reply).toContain(successBullets[0]);
    expect(filed?.reply).toMatch(/Not saved yet/);
    expect(filed?.reply).not.toContain(successProse);
    expect(filed?.reply).not.toMatch(/one section at a time/i);

    state.pending = null;
    const proposedSuccess = await settle(successRequest, {
      reply:
        'These checks are a suggestion and are not saved until you confirm.',
      patch: {
        successCriteriaBullets: successBullets,
        goal: 'replaced',
        scopeIn: ['in-scope check'],
      },
    });
    expect(calls).toContain(successRequest);
    expect(proposedSuccess?.wrote).toBe(false);
    expect(proposedSuccess?.pending?.step).toBe('success');
    expect(proposedSuccess?.pending?.patch.successCriteriaBullets).toEqual(
      successBullets,
    );
    expect(proposedSuccess?.pending?.patch.scopeIn).toBeUndefined();
    expect(proposedSuccess?.draft.successCriteria).toBe('');
    expect(proposedSuccess?.draft.goal).toBe(accepted);
    expect(proposedSuccess?.reply).toMatch(/Not saved yet/);
    expect(proposedSuccess?.reply).not.toMatch(/one section at a time/i);
    expect(proposedSuccess?.reply).not.toContain(successRequest);

    state.pending = proposedSuccess?.pending ?? null;
    const savedSuccess = await settle('yes', null);
    expect(savedSuccess?.wrote).toBe(true);
    expect(savedSuccess?.pending).toBeNull();
    expect(savedSuccess?.draft.successCriteria).toContain(successBullets[0]);
    expect(savedSuccess?.draft.successCriteria).toContain(successBullets[1]);
    expect(savedSuccess?.draft.goal).toBe(accepted);
    expect(savedSuccess?.draft.scopeIn).toEqual([]);
  });
});
