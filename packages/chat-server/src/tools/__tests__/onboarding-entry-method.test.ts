import { describe, expect, it } from 'vitest';

import {
  buildEntryMethodAssistantInstruction,
  buildOnboardingEntryMethodGuidelines,
  ONBOARDING_ENTRY_METHOD_LABELS,
  ONBOARDING_ENTRY_METHOD_OPTIONS,
} from '../onboarding-entry-method';

describe('onboarding entry method catalog', () => {
  it('matches UI card titles in English', () => {
    expect(ONBOARDING_ENTRY_METHOD_LABELS).toEqual([
      'Open Access',
      'Invite Request',
      'Token Based',
    ]);
    expect(ONBOARDING_ENTRY_METHOD_OPTIONS).toHaveLength(3);
  });

  it('localizes assistant instructions for French', () => {
    const instruction = buildEntryMethodAssistantInstruction('fr');
    expect(instruction).toContain('- Accès ouvert:');
    expect(instruction).toContain("- Demande d'invitation:");
    expect(instruction).toContain('- Basé sur des tokens:');
    expect(instruction).not.toContain('- Open Access:');
  });

  it('localizes onboarding guidelines for French', () => {
    const guidelines = buildOnboardingEntryMethodGuidelines('fr');
    expect(guidelines).toContain('Accès ouvert');
    expect(guidelines).toContain("Demande d'invitation");
    expect(guidelines).toContain('Basé sur des tokens');
  });

  it('instructs assistant with bullet options and forbids wrong labels', () => {
    const instruction = buildEntryMethodAssistantInstruction();
    expect(instruction).toContain('- Open Access:');
    expect(instruction).toContain('- Invite Request:');
    expect(instruction).toContain('- Token Based:');
    expect(instruction).toContain('never invite-only');
  });
});
