import { describe, expect, it } from 'vitest';

import { isValidReactionKey } from '../reactions';

describe('isValidReactionKey', () => {
  it('accepts common emoji', () => {
    expect(isValidReactionKey('👍')).toBe(true);
    expect(isValidReactionKey('😄')).toBe(true);
  });

  it('rejects empty and non-emoji text', () => {
    expect(isValidReactionKey('')).toBe(false);
    expect(isValidReactionKey('hello')).toBe(false);
    expect(isValidReactionKey('a')).toBe(false);
  });

  it('rejects whitespace and control chars', () => {
    expect(isValidReactionKey('👍 ')).toBe(false);
    expect(isValidReactionKey(' 👍')).toBe(false);
  });
});
