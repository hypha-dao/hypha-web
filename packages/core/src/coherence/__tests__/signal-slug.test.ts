import { describe, expect, it } from 'vitest';
import { signalSlugMatchesSpaceSlug } from '../signal-slug';

describe('signalSlugMatchesSpaceSlug', () => {
  it('matches only a trimmed signal slug equal to its space slug', () => {
    expect(signalSlugMatchesSpaceSlug('hypha', 'hypha')).toBe(true);
    expect(signalSlugMatchesSpaceSlug(' hypha ', 'hypha')).toBe(true);
    expect(signalSlugMatchesSpaceSlug('coh-ab12cd34', 'hypha')).toBe(false);
    expect(signalSlugMatchesSpaceSlug('', 'hypha')).toBe(false);
    expect(signalSlugMatchesSpaceSlug('hypha', null)).toBe(false);
  });
});
