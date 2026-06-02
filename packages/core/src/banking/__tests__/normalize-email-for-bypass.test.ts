import { describe, expect, it } from 'vitest';

import {
  emailsMatchForBypass,
  normalizeEmailForBypassComparison,
} from '../normalize-email-for-bypass';

describe('normalizeEmailForBypassComparison', () => {
  it('strips plus-address suffix before comparing', () => {
    expect(
      emailsMatchForBypass(
        'user+test@gmail.com',
        'user@gmail.com',
      ),
    ).toBe(true);
    expect(
      normalizeEmailForBypassComparison('User+Tag@Example.com'),
    ).toBe('user@example.com');
  });

  it('does not treat different local parts as equal', () => {
    expect(emailsMatchForBypass('a@gmail.com', 'b@gmail.com')).toBe(false);
  });
});
