import { describe, expect, it } from 'vitest';

import type { OnboardingConversationContext } from '../ai-onboarding-context';
import { shouldAttachOnboardingContext } from '../onboarding-context-attach';

function baseContext(
  overrides: Partial<OnboardingConversationContext> = {},
): OnboardingConversationContext {
  return {
    mode: 'onboarding_setup',
    source: 'onboarding_hero',
    setupPhase: 'discover',
    setupJourney: 'single_space',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('shouldAttachOnboardingContext', () => {
  it('attaches on the onboarding path regardless of phase', () => {
    const context = baseContext({ setupPhase: 'execute' });
    expect(
      shouldAttachOnboardingContext(context, { isOnboardingPath: true }),
    ).toBe(true);
  });

  it('does not attach discover phase to an unrelated space', () => {
    const context = baseContext({ setupPhase: 'discover' });
    expect(
      shouldAttachOnboardingContext(context, {
        spaceSlug: 'hypha-platform',
      }),
    ).toBe(false);
  });

  it('attaches execute phase only on the created anchor slug', () => {
    const context = baseContext({
      setupPhase: 'execute',
      createdSpaceSlug: 'my-root',
    });
    expect(
      shouldAttachOnboardingContext(context, { spaceSlug: 'my-root' }),
    ).toBe(true);
    expect(
      shouldAttachOnboardingContext(context, { spaceSlug: 'hypha-platform' }),
    ).toBe(false);
  });

  it('does not attach execute phase without an anchor slug', () => {
    const context = baseContext({ setupPhase: 'execute' });
    expect(
      shouldAttachOnboardingContext(context, { spaceSlug: 'hypha-platform' }),
    ).toBe(false);
  });

  it('attaches ecosystem execute phase to blueprint child slugs', () => {
    const context = baseContext({
      setupPhase: 'execute',
      setupJourney: 'ecosystem',
      ecosystemRootSlug: 'acme',
      setupPlan: {
        ecosystemBlueprint: [
          {
            key: 'community',
            role: 'community_hub',
            title: 'Community',
            status: 'planned',
          },
        ],
      },
    });

    expect(
      shouldAttachOnboardingContext(context, { spaceSlug: 'acme-community' }),
    ).toBe(true);
    expect(
      shouldAttachOnboardingContext(context, { spaceSlug: 'hypha-platform' }),
    ).toBe(false);
  });
});
