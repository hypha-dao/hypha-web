import { describe, expect, it } from 'vitest';

import {
  buildOnboardingLocaleDirective,
  resolveSupportedUiLocale,
} from '../onboarding-locale';

describe('resolveSupportedUiLocale', () => {
  it('accepts Hypha UI locale codes', () => {
    expect(resolveSupportedUiLocale('de')).toBe('de');
    expect(resolveSupportedUiLocale('pt-BR')).toBe('pt');
    expect(resolveSupportedUiLocale('fr-FR')).toBe('fr');
    expect(resolveSupportedUiLocale('mk')).toBe('mk');
  });

  it('rejects unsupported locales', () => {
    expect(resolveSupportedUiLocale('ja')).toBeNull();
    expect(resolveSupportedUiLocale(undefined)).toBeNull();
  });
});

describe('buildOnboardingLocaleDirective', () => {
  it('returns a language directive for supported locales', () => {
    expect(buildOnboardingLocaleDirective('de')).toContain('German');
    expect(buildOnboardingLocaleDirective('pt')).toContain('Portuguese');
    expect(buildOnboardingLocaleDirective('fr-FR')).toContain('French');
  });

  it('lists all supported Hypha languages', () => {
    const directive = buildOnboardingLocaleDirective('en');
    expect(directive).toContain('English');
    expect(directive).toContain('Portuguese');
    expect(directive).toContain('Spanish');
    expect(directive).toContain('French');
    expect(directive).toContain('German');
    expect(directive).toContain('Macedonian');
    expect(directive).toContain('ONLY these 6 languages');
  });

  it('allows switching among the supported languages', () => {
    const directive = buildOnboardingLocaleDirective('en');
    expect(directive).toContain('match their language');
    expect(directive).toContain('switch among any of them');
    expect(directive).not.toContain('even if the user speaks another language');
  });

  it('returns null when locale is missing or unsupported', () => {
    expect(buildOnboardingLocaleDirective(undefined)).toBeNull();
    expect(buildOnboardingLocaleDirective('')).toBeNull();
    expect(buildOnboardingLocaleDirective('ja')).toBeNull();
  });
});
