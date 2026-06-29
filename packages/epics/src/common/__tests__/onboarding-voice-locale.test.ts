import { describe, expect, it } from 'vitest';

import { resolveOnboardingSpeechLocale } from '../onboarding-voice-locale';

describe('resolveOnboardingSpeechLocale', () => {
  it('maps Hypha locales to BCP-47 speech tags', () => {
    expect(resolveOnboardingSpeechLocale('en')).toBe('en-US');
    expect(resolveOnboardingSpeechLocale('pt')).toBe('pt-BR');
    expect(resolveOnboardingSpeechLocale('es')).toBe('es-ES');
    expect(resolveOnboardingSpeechLocale('fr')).toBe('fr-FR');
    expect(resolveOnboardingSpeechLocale('de')).toBe('de-DE');
  });

  it('accepts regional locale prefixes', () => {
    expect(resolveOnboardingSpeechLocale('pt-PT')).toBe('pt-BR');
    expect(resolveOnboardingSpeechLocale('en-GB')).toBe('en-US');
  });
});
