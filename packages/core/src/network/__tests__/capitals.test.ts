import { describe, expect, it } from 'vitest';
import {
  CAPITALS,
  CAPITAL_FORM,
  parseCapitalKey,
  parseCapitalKeys,
} from '../capitals';

describe('forms of capital', () => {
  it('keeps one catalog in canonical order', () => {
    expect(CAPITALS).toHaveLength(11);
    CAPITALS.forEach((key, order) => {
      expect(CAPITAL_FORM[key]).toEqual({ key, order });
    });
  });

  it('accepts one known key and rejects anything else', () => {
    expect(parseCapitalKey('wisdom')).toBe('wisdom');
    expect(parseCapitalKey('Wisdom')).toBeNull();
    expect(parseCapitalKey('')).toBeNull();
    expect(parseCapitalKey(null)).toBeNull();
  });

  it('keeps the first of each known key', () => {
    expect(parseCapitalKeys(['social', 'nope', 'social', 'living'])).toEqual([
      'social',
      'living',
    ]);
    expect(parseCapitalKeys(undefined)).toEqual([]);
  });
});
