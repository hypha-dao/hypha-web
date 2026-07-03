import { describe, expect, it } from 'vitest';

import { shouldUseCreateEcosystemSpaceInstead } from '../tools/create-space-from-onboarding-redirect';

describe('shouldUseCreateEcosystemSpaceInstead', () => {
  it('redirects during execute phase', () => {
    const result = shouldUseCreateEcosystemSpaceInstead({
      onboarding_setup_phase: 'execute',
    });
    expect(result.redirect).toBe(true);
  });

  it('redirects when root was already created in session', () => {
    const result = shouldUseCreateEcosystemSpaceInstead({
      onboarding_created_space_slug: 'my-root',
    });
    expect(result.redirect).toBe(true);
  });

  it('redirects nested ecosystem spaces under a live on-chain parent', () => {
    const result = shouldUseCreateEcosystemSpaceInstead(
      {
        onboarding_setup_journey: 'ecosystem',
        parent_space_slug: 'my-root',
      },
      { web3SpaceId: 42, parentId: null },
    );
    expect(result.redirect).toBe(true);
  });

  it('allows root creation during confirm phase', () => {
    const result = shouldUseCreateEcosystemSpaceInstead({
      onboarding_setup_phase: 'confirm',
      onboarding_setup_journey: 'ecosystem',
    });
    expect(result.redirect).toBe(false);
  });
});
