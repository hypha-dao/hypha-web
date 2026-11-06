import { describe, expect, it } from 'vitest';
import { limitQuestPatchToStep } from '../guided-step';

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
