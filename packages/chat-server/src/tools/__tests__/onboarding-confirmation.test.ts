import { describe, expect, it } from 'vitest';
import {
  hasOnboardingConfirmation,
  hasRecentVisualGenerationRequest,
  wantsGeneratedVisualsFromText,
} from '../onboarding-confirmation';

describe('onboarding confirmation helpers', () => {
  it('treats setupPhase confirm as confirmed', () => {
    expect(
      hasOnboardingConfirmation(
        { setupPhase: 'confirm', lastUserText: 'already did' },
        'confirm-create-space',
      ),
    ).toBe(true);
  });

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
});
