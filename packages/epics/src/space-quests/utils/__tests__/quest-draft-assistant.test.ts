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
  it('fills goal and derives an initial quest name on step 0', () => {
    const patch = buildLocalQuestDraftPatch({
      message: 'We want to build an onboarding matcher for new joiners.',
      currentStep: 'goal',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.goal).toBe(
      'We want to build an onboarding matcher for new joiners.',
    );
    expect(patch.name).toBe('Build an onboarding matcher for new');
  });

  it('synthesizes scope, success criteria, milestones, and target date on auto-draft requests', () => {
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
    const { next, updatedLabels } = applyPatchToQuestDraftState({
      current: withGoal,
      patch,
      spaceMembers: [],
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(next.scopeIn.length).toBeGreaterThan(0);
    expect(next.scopeOut.length).toBeGreaterThan(0);
    expect(next.successCriteria).toContain('- ');
    expect(next.milestones.length).toBe(3);
    expect(next.targetDate).toBeTruthy();
    expect(updatedLabels).toEqual(
      expect.arrayContaining(['Scope', 'Success criteria', 'Milestones']),
    );
    expect(findNextUnfilledQuestStep(next, 'scope')).toBe('members');
  });

  it('extracts multiple rewards and labeled sections from a single prompt', () => {
    const patch = buildLocalQuestDraftPatch({
      message:
        'Goal: Ship Context v2\nIn: Markdown editor; Agent prompts\nOut: Cross-space search\nReward: 2,500 USDC + 0.4 ETH',
      currentStep: 'goal',
      draft: emptyDraft,
      viewerDisplayName: 'Vlad Hramtsov',
    });
    expect(patch.goal).toBe('Ship Context v2');
    expect(patch.scopeIn).toEqual(['Markdown editor', 'Agent prompts']);
    expect(patch.scopeOut).toEqual(['Cross-space search']);
    expect(patch.rewards).toEqual([
      { amount: '2500', token: 'USDC' },
      { amount: '0.4', token: 'ETH' },
    ]);
  });
});
