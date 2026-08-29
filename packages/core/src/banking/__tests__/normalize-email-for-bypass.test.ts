import { describe, expect, it } from 'vitest';

import {
  isBypassEligible,
  normalizeEmailForBypass,
} from '../normalize-email-for-bypass';

describe('normalizeEmailForBypass', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmailForBypass('  Me@Example.com  ')).toBe(
      'me@example.com',
    );
  });

  it('strips a plus-address suffix from the local part only', () => {
    expect(normalizeEmailForBypass('me+test@example.com')).toBe(
      'me@example.com',
    );
  });

  it('leaves a + in the domain (malformed input) untouched beyond lowercasing', () => {
    expect(normalizeEmailForBypass('me')).toBe('me');
  });
});

describe('isBypassEligible', () => {
  it('is eligible when the submitted email is a plus-addressed variant of the submitter email', () => {
    expect(isBypassEligible('me@example.com', 'me+sandbox@example.com')).toBe(
      true,
    );
  });

  it('is eligible for an exact case-insensitive match', () => {
    expect(isBypassEligible('Me@Example.com', 'me@example.com')).toBe(true);
  });

  it('is not eligible for a different email entirely', () => {
    expect(isBypassEligible('me@example.com', 'someone-else@example.com')).toBe(
      false,
    );
  });

  it('is not eligible when the submitter has no email on file', () => {
    expect(isBypassEligible(null, 'me@example.com')).toBe(false);
  });
});
