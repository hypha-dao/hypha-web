import { describe, expect, it } from 'vitest';

import { buildOnboardingLocaleDirective } from '../onboarding-locale';

describe('buildOnboardingLocaleDirective', () => {
  it('returns a language directive for supported locales', () => {
    expect(buildOnboardingLocaleDirective('de')).toContain('German');
    expect(buildOnboardingLocaleDirective('pt')).toContain('Portuguese');
    expect(buildOnboardingLocaleDirective('fr-FR')).toContain('French');
  });

  it('returns null when locale is missing', () => {
    expect(buildOnboardingLocaleDirective(undefined)).toBeNull();
    expect(buildOnboardingLocaleDirective('')).toBeNull();
  });
});
