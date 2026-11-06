import { describe, expect, it } from 'vitest';
import { limitQuestPatchToStep, resolveQuestDraftTarget } from '../guided-step';

describe('limitQuestPatchToStep', () => {
  it('keeps the goal and drops every other section', () => {
    expect(
      limitQuestPatchToStep(
        {
          goal: 'Ship the matcher',
          name: 'Matcher',
          scopeIn: ['Editor'],
          milestones: [{ name: 'M1' }],
          rewards: [{ amount: '10', token: 'USDC' }],
        },
        'goal',
      ),
    ).toEqual({ goal: 'Ship the matcher' });
  });

  it('keeps both scope lists and drops an empty one', () => {
    expect(
      limitQuestPatchToStep(
        {
          goal: 'Ship the matcher',
          scopeIn: ['Editor'],
          scopeOut: [],
        },
        'scope',
      ),
    ).toEqual({ scopeIn: ['Editor'] });
  });
});

describe('resolveQuestDraftTarget', () => {
  const modelPatch = {
    scopeIn: ['Sandbox quest'],
    scopeOut: ['Voting'],
    successCriteriaBullets: ['A pass is recorded'],
    milestones: [{ name: 'M1' }],
    members: [{ memberName: 'Vlad' }],
  };

  it('writes nothing when asked to draft everything', () => {
    const target = resolveQuestDraftTarget(
      'Please draft everything for me.',
      'scope',
    );
    expect(target).toEqual({ step: 'scope', bulk: true });
    expect(
      target.bulk ? {} : limitQuestPatchToStep(modelPatch, target.step),
    ).toEqual({});
  });

  it('keeps a scope-only ask on scope when the tracker has moved on to success', () => {
    const message =
      'Yes, all three checks run inside the sandbox with throwaway accounts, nothing external. Please help me with the Scope section only: tighten the in-scope and out-of-scope lists.';
    const target = resolveQuestDraftTarget(message, 'success');
    expect(target).toEqual({ step: 'scope', bulk: false });
    expect(limitQuestPatchToStep(modelPatch, target.step)).toEqual({
      scopeIn: ['Sandbox quest'],
      scopeOut: ['Voting'],
    });
  });

  it('keeps a success-only ask off milestones even when the body mentions them', () => {
    const message =
      'Focus only on Success Criteria now. A pass means Quest Helper replies to every prompt, only the requested section changes, and one sandbox quest proposal is created with one Lead and three safe milestones. No completion is required. Keep all other sections unchanged.';
    const target = resolveQuestDraftTarget(message, 'milestones');
    expect(target).toEqual({ step: 'success', bulk: false });
    expect(limitQuestPatchToStep(modelPatch, target.step)).toEqual({
      successCriteriaBullets: ['A pass is recorded'],
    });
  });

  it('routes "focus only on scope" to scope when the tracker is already on success', () => {
    const target = resolveQuestDraftTarget(
      'Focus only on Scope now: in-scope: one sandbox quest. Out of scope: voting. Keep every other section unchanged.',
      'success',
    );
    expect(target).toEqual({ step: 'scope', bulk: false });
    expect(limitQuestPatchToStep(modelPatch, target.step)).toEqual({
      scopeIn: ['Sandbox quest'],
      scopeOut: ['Voting'],
    });
  });

  it('keeps a milestones-only ask off members', () => {
    const target = resolveQuestDraftTarget(
      'Focus only on Milestones now. M1 checklist, M2 sandbox run, M3 report.',
      'members',
    );
    expect(target).toEqual({ step: 'milestones', bulk: false });
    expect(limitQuestPatchToStep(modelPatch, target.step)).toEqual({
      milestones: [{ name: 'M1' }],
    });
  });

  it('routes "now let\'s define the scope" to scope without writing it', () => {
    const target = resolveQuestDraftTarget(
      "Now let's define the scope",
      'goal',
    );
    expect(target).toEqual({ step: 'scope', bulk: false });
  });

  it('leaves an ordinary goal answer on the goal step', () => {
    expect(
      resolveQuestDraftTarget(
        'We want to build an onboarding matcher for new joiners.',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      resolveQuestDraftTarget(
        'Validate sandbox onboarding with three documented checks by 30 November 2026',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: false });
  });

  it('routes an explicit milestones list to milestones after the tracker moved to scope', () => {
    const message =
      'Exactly 3 milestones: M1 titled Run check one, due 20 November 2026; M2 titled Run check two, due 25 November 2026; M3 titled Run check three, due 30 November 2026. Owner Vlad Hramtsov for all. Please propose these as Milestones in chat first.';
    expect(resolveQuestDraftTarget(message, 'scope')).toEqual({
      step: 'milestones',
      bulk: false,
    });
    expect(resolveQuestDraftTarget(message, 'goal')).toEqual({
      step: 'milestones',
      bulk: false,
    });
  });

  it('routes dash-separated milestone lines to milestones from scope', () => {
    const message = [
      'Run check one - 20 November 2026 - Vlad Hramtsov',
      'Run check two - 25 November 2026 - Vlad Hramtsov',
      'Run check three - 30 November 2026 - Vlad Hramtsov',
    ].join('\n');
    expect(resolveQuestDraftTarget(message, 'scope')).toEqual({
      step: 'milestones',
      bulk: false,
    });
  });

  it('lets a named section win over milestone-shaped lines', () => {
    expect(
      resolveQuestDraftTarget(
        'Focus only on Success Criteria. M1 titled Run check one, due 20 November 2026; M2 titled Run check two, due 25 November 2026.',
        'scope',
      ),
    ).toEqual({ step: 'success', bulk: false });
  });
});
