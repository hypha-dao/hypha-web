import { describe, expect, it } from 'vitest';
import {
  questMilestoneDescriptionAddsDetail,
  questMilestoneDescriptionText,
} from '../milestone-description';

describe('quest milestone descriptions', () => {
  const title = 'Training curriculum designed with the core team';
  const description =
    'Draft the onboarding curriculum and review it with the core team';

  it('keeps a description that adds detail beyond the title', () => {
    expect(questMilestoneDescriptionText(title, description)).toBe(description);
    expect(questMilestoneDescriptionAddsDetail(title, description)).toBe(true);
  });

  it('drops a description that only repeats the title', () => {
    expect(questMilestoneDescriptionText(title, `  ${title}. `)).toBe('');
    expect(questMilestoneDescriptionAddsDetail(title, title)).toBe(false);
    expect(questMilestoneDescriptionAddsDetail(title, '')).toBe(false);
    expect(questMilestoneDescriptionAddsDetail(title, null)).toBe(false);
  });

  it('rejects a light rephrase that adds no new detail', () => {
    expect(
      questMilestoneDescriptionAddsDetail(
        title,
        'Training curriculum designed with the core team now',
      ),
    ).toBe(false);
  });
});
