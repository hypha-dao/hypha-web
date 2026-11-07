import { describe, expect, it } from 'vitest';
import {
  existingQuestEditSection,
  isBulkQuestDraftRequest,
  limitQuestPatchToStep,
  questDraftCoachedStep,
  questExistingTurnMayPersist,
  questPendingYesNotice,
  resolveQuestDraftTarget,
  scopeBoundaryLists,
} from '../guided-step';

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

describe('questExistingTurnMayPersist', () => {
  it('saves an explicit edit and leaves questions in the chat', () => {
    expect(
      questExistingTurnMayPersist(
        'Change the goal to "Verify the create draft shows the goal"',
      ),
    ).toBe(true);
    expect(
      questExistingTurnMayPersist('Please set the scope to sandbox checklist'),
    ).toBe(true);
    expect(
      questExistingTurnMayPersist('do you think that is a good goal?'),
    ).toBe(false);
    expect(questExistingTurnMayPersist('how should we scope this?')).toBe(
      false,
    );
    expect(questExistingTurnMayPersist('improve the goal')).toBe(false);
    expect(
      questExistingTurnMayPersist('We update members on progress every week'),
    ).toBe(false);
    expect(questExistingTurnMayPersist('Add lead scoring to the CRM')).toBe(
      false,
    );
    expect(questExistingTurnMayPersist('Update the members')).toBe(false);
    expect(
      questExistingTurnMayPersist('Set the scope: sandbox checklist'),
    ).toBe(true);
    const quoted = 'Set the scope to "write all onboarding docs"';
    expect(questExistingTurnMayPersist(quoted)).toBe(true);
    expect(existingQuestEditSection(quoted)).toBe('scope');
    expect(isBulkQuestDraftRequest(quoted)).toBe(false);
    expect(resolveQuestDraftTarget(quoted, 'goal')).toEqual({
      step: 'scope',
      bulk: false,
    });
    expect(
      resolveQuestDraftTarget(
        'Put in goal "Generate onboarding sections per team"',
        'scope',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      resolveQuestDraftTarget(
        'Draft everything. Set the scope to "sandbox checklist"',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: true });
    expect(
      resolveQuestDraftTarget(
        'Draft the scope, success criteria, and milestones. Set the scope to "write all onboarding docs"',
        'scope',
      ),
    ).toEqual({ step: 'scope', bulk: true });
    expect(existingQuestEditSection('improve the goal')).toBeNull();
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

  it('routes an imperative section command to that section', () => {
    expect(
      resolveQuestDraftTarget(
        'Put in goal "Testing out the quest feature"',
        'scope',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      resolveQuestDraftTarget(
        'Please set the scope to sandbox checklist',
        'goal',
      ),
    ).toEqual({ step: 'scope', bulk: false });
    expect(
      resolveQuestDraftTarget(
        'The draft is ready. Put in goal "Ship the matcher"',
        'success',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(resolveQuestDraftTarget('put that in the Goal', 'scope')).toEqual({
      step: 'scope',
      bulk: false,
    });
  });

  it('keeps a verb inside ordinary prose on the current section', () => {
    expect(
      resolveQuestDraftTarget('Members use rewards within 7 days', 'success'),
    ).toEqual({ step: 'success', bulk: false });
    expect(
      resolveQuestDraftTarget('Add lead scoring to the CRM', 'success'),
    ).toEqual({ step: 'success', bulk: false });
    expect(resolveQuestDraftTarget('improve the goal', 'scope')).toEqual({
      step: 'goal',
      bulk: false,
    });
    expect(
      resolveQuestDraftTarget(
        'We update members on progress every week',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      resolveQuestDraftTarget('Write success stories for new joiners', 'goal'),
    ).toEqual({ step: 'goal', bulk: false });
    expect(resolveQuestDraftTarget('Update the members', 'goal')).toEqual({
      step: 'members',
      bulk: false,
    });
    expect(
      resolveQuestDraftTarget('Write the success criteria', 'goal'),
    ).toEqual({ step: 'success', bulk: false });
    expect(resolveQuestDraftTarget('Revise the goal', 'scope')).toEqual({
      step: 'goal',
      bulk: false,
    });
  });

  it('revisits one named section and refuses a revision of several', () => {
    const proposeGoal =
      'Please propose a shorter version of the goal for my confirmation';
    const shorterStill = 'no, make it shorter still and drop the word sandbox';
    const both = 'Please propose shorter versions of the goal and the scope';
    expect(resolveQuestDraftTarget(proposeGoal, 'scope')).toEqual({
      step: 'goal',
      bulk: false,
    });
    expect(isBulkQuestDraftRequest(proposeGoal)).toBe(false);
    expect(questDraftCoachedStep(shorterStill, 'scope', 'goal')).toEqual({
      step: 'goal',
      bulk: false,
    });
    expect(questDraftCoachedStep(shorterStill, 'scope', null)).toEqual({
      step: 'scope',
      bulk: false,
    });
    expect(resolveQuestDraftTarget(both, 'scope')).toEqual({
      step: 'scope',
      bulk: true,
    });
    expect(isBulkQuestDraftRequest(both)).toBe(true);
    expect(
      resolveQuestDraftTarget(
        'do you think the goal is well defined?',
        'scope',
      ),
    ).toEqual({ step: 'scope', bulk: false });
    expect(
      resolveQuestDraftTarget('the goal is shorter than the scope', 'success'),
    ).toEqual({ step: 'success', bulk: false });
    expect(
      resolveQuestDraftTarget('Add lead scoring to the CRM', 'success'),
    ).toEqual({ step: 'success', bulk: false });
    expect(
      isBulkQuestDraftRequest(
        'Draft the scope, success criteria, and milestones',
      ),
    ).toBe(true);
    const successProposal =
      'Please propose these success criteria for my confirmation: each in-scope check is recorded with an explicit pass or fail; the lead reviews the notes.';
    expect(isBulkQuestDraftRequest(successProposal)).toBe(false);
    expect(resolveQuestDraftTarget(successProposal, 'success')).toEqual({
      step: 'success',
      bulk: false,
    });
    expect(resolveQuestDraftTarget(successProposal, 'scope')).toEqual({
      step: 'success',
      bulk: false,
    });
    expect(
      isBulkQuestDraftRequest(
        'Fill out all sections. In scope: verify proposal display. Out of scope: production rollout.',
      ),
    ).toBe(true);
    expect(
      isBulkQuestDraftRequest(
        'Please propose these success criteria for my confirmation: each in-scope check. Draft the milestones too.',
      ),
    ).toBe(true);
    expect(
      isBulkQuestDraftRequest(
        'Success means every listed scope check is recorded with an explicit pass or fail, and the notes are reviewed by the lead.',
      ),
    ).toBe(false);
  });

  it('keeps "a quest about rewards" on the goal step', () => {
    expect(
      resolveQuestDraftTarget(
        'A quest about rewards for new contributors',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: false });
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

  it('routes an explicit in/out scope payload to scope after the tracker moved to members', () => {
    const message =
      'In scope: Run three sandbox onboarding checks and record pass/fail for each. Out of scope: Fixing onboarding; contacting real people; payments or on-chain actions.';
    expect(resolveQuestDraftTarget(message, 'members')).toEqual({
      step: 'scope',
      bulk: false,
    });
    expect(resolveQuestDraftTarget(message, 'lead')).toEqual({
      step: 'scope',
      bulk: false,
    });
  });

  it('routes other labeled sections off the current walk step', () => {
    expect(
      resolveQuestDraftTarget(
        'Success criteria: each check has a recorded pass or fail.',
        'members',
      ),
    ).toEqual({ step: 'success', bulk: false });
    expect(resolveQuestDraftTarget('Lead: Vlad Hramtsov', 'members')).toEqual({
      step: 'lead',
      bulk: false,
    });
    expect(resolveQuestDraftTarget('Reward: 2,500 USDC', 'milestones')).toEqual(
      { step: 'rewards', bulk: false },
    );
    expect(
      resolveQuestDraftTarget(
        'Vlad Hramtsov: run the sandbox checks',
        'members',
      ),
    ).toEqual({ step: 'members', bulk: false });
  });

  it('keeps one labeled scope payload on scope when the payload mentions another section', () => {
    const message =
      'Please propose these exact scope boundaries for my confirmation: In scope: verify proposal display and milestone editing in sandbox; out of scope: production rollout.';
    expect(resolveQuestDraftTarget(message, 'scope')).toEqual({
      step: 'scope',
      bulk: false,
    });
    expect(
      resolveQuestDraftTarget(
        'Draft the scope, success criteria, and milestones.',
        'scope',
      ),
    ).toEqual({ step: 'scope', bulk: true });
    expect(
      resolveQuestDraftTarget(
        'Draft everything. In scope: verify proposal display.',
        'goal',
      ),
    ).toEqual({ step: 'goal', bulk: true });
    const colonSeveral =
      'Draft the scope, success criteria, and milestones. In scope: verify proposal display and milestone editing in sandbox. Out of scope: production rollout.';
    expect(isBulkQuestDraftRequest(colonSeveral)).toBe(true);
    expect(resolveQuestDraftTarget(colonSeveral, 'scope')).toEqual({
      step: 'scope',
      bulk: true,
    });
  });

  it('treats one unpunctuated scope boundary as scope and keeps a multi-section command bulk', () => {
    const requested =
      'Please propose these exact scope boundaries for my confirmation: in scope verify proposal display and milestone editing in sandbox; out of scope production rollout.';
    expect(scopeBoundaryLists(requested)).toEqual({
      scopeIn: 'verify proposal display and milestone editing in sandbox',
      scopeOut: 'production rollout',
    });
    expect(isBulkQuestDraftRequest(requested)).toBe(false);
    expect(resolveQuestDraftTarget(requested, 'scope')).toEqual({
      step: 'scope',
      bulk: false,
    });
    const several =
      'Draft the scope, success criteria, and milestones. in scope verify proposal display and milestone editing in sandbox; out of scope production rollout.';
    expect(scopeBoundaryLists(several)).toBeNull();
    expect(isBulkQuestDraftRequest(several)).toBe(true);
    expect(resolveQuestDraftTarget(several, 'scope')).toEqual({
      step: 'scope',
      bulk: true,
    });
    const colonSeveral =
      'Draft the scope, success criteria, and milestones. In scope: verify proposal display and milestone editing in sandbox. Out of scope: production rollout.';
    expect(scopeBoundaryLists(colonSeveral)).toBeNull();
    expect(isBulkQuestDraftRequest(colonSeveral)).toBe(true);
    expect(resolveQuestDraftTarget(colonSeveral, 'scope')).toEqual({
      step: 'scope',
      bulk: true,
    });
    expect(
      isBulkQuestDraftRequest(
        'In scope: verify proposal display and milestone editing in sandbox; out of scope: production rollout.',
      ),
    ).toBe(false);
    expect(
      resolveQuestDraftTarget(
        'Success criteria: each check has a recorded pass or fail.',
        'scope',
      ),
    ).toEqual({ step: 'success', bulk: false });
    expect(
      isBulkQuestDraftRequest(
        'Draft the scope, success criteria, and milestones.',
      ),
    ).toBe(true);
  });

  it('parses scope boundaries with long spaces and tabs in linear time', () => {
    const gap = ' \t'.repeat(4000);
    const requested = `Please propose these exact scope boundaries for my confirmation:${gap}in${gap}scope${gap}verify proposal display and milestone editing in sandbox;${gap}out${gap}of${gap}scope${gap}production rollout.`;
    const started = Date.now();
    expect(scopeBoundaryLists(requested)).toEqual({
      scopeIn: 'verify proposal display and milestone editing in sandbox',
      scopeOut: 'production rollout',
    });
    expect(isBulkQuestDraftRequest(requested)).toBe(false);
    expect(resolveQuestDraftTarget(requested, 'scope')).toEqual({
      step: 'scope',
      bulk: false,
    });
    const several = `Draft the scope, success criteria, and milestones.${gap}in${gap}scope${gap}verify proposal display and milestone editing in sandbox;${gap}out${gap}of${gap}scope${gap}production rollout.`;
    expect(scopeBoundaryLists(several)).toBeNull();
    expect(isBulkQuestDraftRequest(several)).toBe(true);
    expect(resolveQuestDraftTarget(several, 'scope')).toEqual({
      step: 'scope',
      bulk: true,
    });
    expect(
      scopeBoundaryLists('In scope: alpha; beta. Out of scope: gamma; delta.'),
    ).toEqual({
      scopeIn: 'alpha; beta.',
      scopeOut: 'gamma; delta',
    });
    expect(scopeBoundaryLists('in\tscope\tfoo\tout\tof\tscope\tbar!')).toEqual({
      scopeIn: 'foo',
      scopeOut: 'bar',
    });
    expect(scopeBoundaryLists(`in${gap}scope${gap}`)).toBeNull();
    expect(
      scopeBoundaryLists(
        `${gap}out${gap}of${gap}scope${gap}production rollout`,
      ),
    ).toBeNull();
    expect(
      scopeBoundaryLists(`in${gap}scope${gap}out${gap}of${gap}scope${gap}`),
    ).toBeNull();
    expect(
      scopeBoundaryLists(
        `in${gap}scope${';'.repeat(
          2000,
        )}${gap}out${gap}of${gap}scope${gap}production`,
      ),
    ).toBeNull();
    expect(scopeBoundaryLists('in scope ;; out of scope bar')).toBeNull();
    expect(scopeBoundaryLists('in scope foo out of scope')).toBeNull();
    expect(scopeBoundaryLists('within scope foo out of scope bar')).toBeNull();
    expect(scopeBoundaryLists('in scopes foo out of scope bar')).toBeNull();
    expect(Date.now() - started).toBeLessThan(250);
  });

  it('names the section a preserved suggestion still applies to', () => {
    const sections = [
      ['goal', 'Goal'],
      ['scope', 'Scope'],
      ['success', 'Success criteria'],
      ['milestones', 'Milestones'],
      ['members', 'Members'],
      ['lead', 'Lead'],
      ['targetDate', 'Target date'],
      ['rewards', 'Quest Reward'],
      ['name', 'Name'],
    ] as const;
    for (const [step, section] of sections) {
      const notice = questPendingYesNotice(step);
      expect(notice).toBe(
        `The ${section} suggestion is still waiting on a yes. Yes applies that ${section} suggestion and nothing else.`,
      );
      expect(notice).not.toMatch(
        new RegExp(`The ${section} is still waiting`, 'i'),
      );
    }
  });

  it('keeps an embedded abbreviation inside one goal command', () => {
    const embedded = 'Set the goal to include "e.g." then write all docs';
    expect(isBulkQuestDraftRequest(embedded)).toBe(false);
    expect(resolveQuestDraftTarget(embedded, 'scope')).toEqual({
      step: 'goal',
      bulk: false,
    });
    const bare = 'Set the goal to include e.g. then write all docs';
    expect(isBulkQuestDraftRequest(bare)).toBe(false);
    expect(resolveQuestDraftTarget(bare, 'milestones')).toEqual({
      step: 'goal',
      bulk: false,
    });
    const ie = 'Set the goal to include i.e. the sandbox then write all docs';
    expect(isBulkQuestDraftRequest(ie)).toBe(false);
    const decimal = 'Set the goal to reach 3.5 spaces then write all docs';
    expect(isBulkQuestDraftRequest(decimal)).toBe(false);
    const quotedSentence =
      'Set the goal to include "U.S. docs." then write all docs';
    expect(isBulkQuestDraftRequest(quotedSentence)).toBe(false);

    const nextSentence =
      'Set the goal to ship the checklist. Draft the scope, success criteria, and milestones.';
    expect(isBulkQuestDraftRequest(nextSentence)).toBe(true);
    expect(resolveQuestDraftTarget(nextSentence, 'goal')).toEqual({
      step: 'goal',
      bulk: true,
    });
    const afterQuote =
      'Set the goal to include "ship it." Draft the scope, success criteria, and milestones.';
    expect(isBulkQuestDraftRequest(afterQuote)).toBe(true);
    const preamble =
      'Draft the scope, success criteria, and milestones. Set the goal to include "e.g." then write all docs';
    expect(isBulkQuestDraftRequest(preamble)).toBe(true);
    expect(resolveQuestDraftTarget(preamble, 'goal')).toEqual({
      step: 'goal',
      bulk: true,
    });
    expect(
      isBulkQuestDraftRequest('Set the scope to "write all onboarding docs"'),
    ).toBe(false);
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
