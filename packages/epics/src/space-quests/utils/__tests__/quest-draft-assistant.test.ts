import { describe, expect, it } from 'vitest';
import {
  applyPatchToQuestDraftState,
  buildLocalQuestDraftPatch,
  findNextUnfilledQuestStep,
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
});
