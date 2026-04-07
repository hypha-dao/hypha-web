import { describe, expect, it } from 'vitest';

import { isValidReactionKey } from '../reactions';

describe('isValidReactionKey', () => {
  it('accepts common emoji', () => {
    expect(isValidReactionKey('👍')).toBe(true);
    expect(isValidReactionKey('😄')).toBe(true);
  });

  it('accepts flag emoji (regional indicator pair)', () => {
    expect(isValidReactionKey('🇩🇪')).toBe(true);
  });

  it('rejects bare variation selector and ZWJ', () => {
    expect(isValidReactionKey('\uFE0F')).toBe(false);
    expect(isValidReactionKey('\u200D')).toBe(false);
  });

  it('rejects empty and non-emoji text', () => {
    expect(isValidReactionKey('')).toBe(false);
    expect(isValidReactionKey('hello')).toBe(false);
    expect(isValidReactionKey('a')).toBe(false);
  });

  it('rejects whitespace and control chars', () => {
    expect(isValidReactionKey('👍 ')).toBe(false);
    expect(isValidReactionKey(' 👍')).toBe(false);
    expect(isValidReactionKey('👍\n')).toBe(false);
    expect(isValidReactionKey('\t👍')).toBe(false);
    expect(isValidReactionKey('\x00👍')).toBe(false);
  });
});
