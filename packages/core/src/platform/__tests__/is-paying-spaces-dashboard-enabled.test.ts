import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_PAYING_SPACES_HIDDEN_SLUGS,
  isPayingSpacesDashboardEnabled,
  isPayingSpacesHiddenForSlug,
} from '../is-paying-spaces-dashboard-enabled';

const HIDDEN_SLUGS_ENV = 'NEXT_PUBLIC_PAYING_SPACES_HIDDEN_SLUGS';
const originalHiddenSlugs = process.env[HIDDEN_SLUGS_ENV];

afterEach(() => {
  if (originalHiddenSlugs === undefined) {
    delete process.env[HIDDEN_SLUGS_ENV];
  } else {
    process.env[HIDDEN_SLUGS_ENV] = originalHiddenSlugs;
  }
});

describe('isPayingSpacesHiddenForSlug', () => {
  it('hides the verified Hypha and Hypha Platform slugs by default', () => {
    delete process.env[HIDDEN_SLUGS_ENV];
    expect([...DEFAULT_PAYING_SPACES_HIDDEN_SLUGS]).toEqual([
      'hypha',
      'hypha-platform',
    ]);
    expect(isPayingSpacesHiddenForSlug('hypha')).toBe(true);
    expect(isPayingSpacesHiddenForSlug('HYPHA')).toBe(true);
    expect(isPayingSpacesHiddenForSlug('hypha-platform')).toBe(true);
    expect(isPayingSpacesHiddenForSlug('hypha-energy')).toBe(false);
  });

  it('treats an empty env override as re-enabled everywhere', () => {
    process.env[HIDDEN_SLUGS_ENV] = '';
    expect(isPayingSpacesHiddenForSlug('hypha')).toBe(false);
    expect(isPayingSpacesHiddenForSlug('hypha-platform')).toBe(false);
  });

  it('replaces the default list when the env override is set', () => {
    process.env[HIDDEN_SLUGS_ENV] = 'hypha';
    expect(isPayingSpacesHiddenForSlug('hypha')).toBe(true);
    expect(isPayingSpacesHiddenForSlug('hypha-platform')).toBe(false);
  });
});

describe('isPayingSpacesDashboardEnabled', () => {
  it('is off for Hypha platform slugs while they are hidden', () => {
    delete process.env[HIDDEN_SLUGS_ENV];
    expect(isPayingSpacesDashboardEnabled({ slug: 'hypha' })).toBe(false);
    expect(isPayingSpacesDashboardEnabled({ slug: 'hypha-platform' })).toBe(
      false,
    );
  });

  it('stays off for unrelated spaces even when the hide list is empty', () => {
    process.env[HIDDEN_SLUGS_ENV] = '';
    expect(isPayingSpacesDashboardEnabled({ slug: 'hypha-energy' })).toBe(
      false,
    );
    expect(isPayingSpacesDashboardEnabled({ slug: 'other' })).toBe(false);
  });

  it('turns back on for Hypha platform slugs when the hide list is cleared', () => {
    process.env[HIDDEN_SLUGS_ENV] = '';
    expect(isPayingSpacesDashboardEnabled({ slug: 'hypha' })).toBe(true);
    expect(isPayingSpacesDashboardEnabled({ slug: 'hypha-platform' })).toBe(
      true,
    );
  });
});
