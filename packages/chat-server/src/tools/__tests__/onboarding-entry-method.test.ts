import { describe, expect, it } from 'vitest';

import {
  buildEntryMethodAssistantInstruction,
  ONBOARDING_ENTRY_METHOD_LABELS,
  ONBOARDING_ENTRY_METHOD_OPTIONS,
} from '../onboarding-entry-method';

describe('onboarding entry method catalog', () => {
  it('matches UI card titles', () => {
    expect(ONBOARDING_ENTRY_METHOD_LABELS).toEqual([
      'Open Access',
      'Invite Request',
      'Token Based',
    ]);
    expect(ONBOARDING_ENTRY_METHOD_OPTIONS).toHaveLength(3);
  });

  it('instructs assistant with bullet options and forbids wrong labels', () => {
    const instruction = buildEntryMethodAssistantInstruction();
    expect(instruction).toContain('- Open Access:');
    expect(instruction).toContain('- Invite Request:');
    expect(instruction).toContain('- Token Based:');
    expect(instruction).toContain('never invite-only');
  });
});
