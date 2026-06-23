import { describe, expect, it } from 'vitest';

import {
  normalizeOnboardingCategories,
  resolveOnboardingCategories,
} from '../onboarding-categories';

describe('normalizeOnboardingCategories', () => {
  it('passes through valid category slugs', () => {
    expect(normalizeOnboardingCategories(['innovation', 'education'])).toEqual(
      expect.arrayContaining(['innovation', 'education']),
    );
  });

  it('maps environment group id to a valid category slug', () => {
    const normalized = normalizeOnboardingCategories(['environment']);
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized).not.toContain('environment');
    expect(normalized).toEqual(expect.arrayContaining(['biodiversity']));
  });

  it('maps group labels to valid category slugs', () => {
    const normalized = normalizeOnboardingCategories([
      'Innovation & Tech',
      'Education & Knowledge',
    ]);
    expect(normalized).toEqual(
      expect.arrayContaining(['innovation', 'education']),
    );
  });

  it('splits comma-separated labels in one token', () => {
    const normalized = normalizeOnboardingCategories(['Innovation, Education']);
    expect(normalized).toEqual(
      expect.arrayContaining(['innovation', 'education']),
    );
  });

  it('maps climate alias to environment group slugs', () => {
    const normalized = normalizeOnboardingCategories(['Climate']);
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized).not.toContain('climate' as Category);
    expect(normalized).toEqual(expect.arrayContaining(['biodiversity']));
  });

  it('infers categories from fallback text when input is invalid', () => {
    const resolved = resolveOnboardingCategories(
      ['not-a-valid-tag'],
      'climate change sustainability ocean biodiversity',
    );
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).not.toContain('environment');
  });
});
