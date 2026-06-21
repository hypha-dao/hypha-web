import { describe, expect, it } from 'vitest';
import {
  hasOnboardingConfirmation,
  hasRecentVisualGenerationRequest,
  resolveLatestVisualGenerationIntent,
  wantsGeneratedVisualsFromText,
} from '../onboarding-confirmation';

describe('onboarding confirmation helpers', () => {
  it('finds confirmation in recent user texts', () => {
    expect(
      hasOnboardingConfirmation(
        {
          lastUserText: 'already did',
          recentUserTexts: ['yes, proceed', 'already did'],
        },
        'confirm-create-space',
      ),
    ).toBe(true);
  });

  it('does not bypass confirmation from setupPhase alone', () => {
    expect(
      hasOnboardingConfirmation(
        { setupPhase: 'confirm', lastUserText: 'tell me more' },
        'confirm-create-space',
      ),
    ).toBe(false);
  });

  it('detects visual generation requests', () => {
    expect(wantsGeneratedVisualsFromText('perfect, generate images')).toBe(
      true,
    );
    expect(
      hasRecentVisualGenerationRequest([
        'expand description',
        'generate images',
      ]),
    ).toBe(true);
  });

  it('uses latest user intent for visual generation requests', () => {
    expect(
      resolveLatestVisualGenerationIntent([
        'generate images',
        "don't generate images",
      ]),
    ).toBe(false);
    expect(
      resolveLatestVisualGenerationIntent([
        "don't generate images",
        'generate a logo please',
      ]),
    ).toBe(true);
  });

  it('ignores negated visual generation requests', () => {
    expect(wantsGeneratedVisualsFromText("don't generate images")).toBe(false);
    expect(wantsGeneratedVisualsFromText('skip image generation')).toBe(false);
  });
});
