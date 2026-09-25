import { describe, expect, it } from 'vitest';

import {
  isNestedOnboardingSpaceCreate,
  validateCreateSpaceGovernanceSettings,
} from '../create-space-from-onboarding-governance';

describe('isNestedOnboardingSpaceCreate', () => {
  it('detects parent slug or name', () => {
    expect(
      isNestedOnboardingSpaceCreate({ parent_space_slug: 'acme-root' }),
    ).toBe(true);
    expect(
      isNestedOnboardingSpaceCreate({ parent_space_name: 'Acme Root' }),
    ).toBe(true);
    expect(isNestedOnboardingSpaceCreate({})).toBe(false);
  });
});

describe('validateCreateSpaceGovernanceSettings', () => {
  it('allows nested creates without transparency or entry', () => {
    expect(
      validateCreateSpaceGovernanceSettings({
        parent_space_slug: 'acme-root',
      }),
    ).toEqual({ ok: true });
  });

  it('blocks root creates missing transparency and entry', () => {
    const result = validateCreateSpaceGovernanceSettings({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing_fields).toEqual([
      'transparency_discoverability',
      'transparency_activity_access',
      'entry_method',
    ]);
    expect(result.requires_transparency_picker).toBe(true);
    expect(result.requires_entry_method_picker).toBe(true);
  });

  it('blocks when only some settings are present', () => {
    const result = validateCreateSpaceGovernanceSettings({
      discoverability: 0,
      access: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing_fields).toEqual(['entry_method']);
    expect(result.requires_transparency_picker).toBe(false);
    expect(result.requires_entry_method_picker).toBe(true);
  });

  it('allows root creates when all settings are present', () => {
    expect(
      validateCreateSpaceGovernanceSettings({
        discoverability: 1,
        access: 2,
        join_method: 0,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects out-of-range levels', () => {
    const result = validateCreateSpaceGovernanceSettings({
      discoverability: 4,
      access: -1,
      join_method: 1.5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing_fields).toHaveLength(3);
  });
});
