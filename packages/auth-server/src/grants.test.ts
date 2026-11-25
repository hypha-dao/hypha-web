import { describe, it, expect } from 'vitest';
import {
  GrantError,
  MAX_SPACE_GRANTS,
  parseGrantClaim,
  parseGrantInput,
} from './grants';

describe('parseGrantInput (consent body)', () => {
  it('accepts "all" and a list of ids, removing duplicates', () => {
    expect(parseGrantInput('all')).toBe('all');
    expect(parseGrantInput([4, 2, 4])).toEqual([4, 2]);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty list (it would grant nothing)', []],
    ['a string id', ['3']],
    ['a fraction', [1.5]],
    ['a negative id', [-1]],
    ['a number outside the safe range', [2 ** 60]],
    ['an unknown keyword', 'some'],
    ['an object', { 0: 1 }],
  ])('refuses %s', (_name, raw) => {
    expect(() => parseGrantInput(raw)).toThrow(GrantError);
  });

  it('refuses more than the cap with its own code', () => {
    const many = Array.from({ length: MAX_SPACE_GRANTS + 1 }, (_, i) => i + 1);
    expect(() => parseGrantInput(many)).toThrow(
      expect.objectContaining({ code: 'too_many_spaces' }),
    );
    expect(parseGrantInput(many.slice(0, MAX_SPACE_GRANTS))).toHaveLength(
      MAX_SPACE_GRANTS,
    );
  });
});

describe('parseGrantClaim (verified token)', () => {
  it('allows an empty list (grants nothing) and "all"', () => {
    expect(parseGrantClaim([])).toEqual([]);
    expect(parseGrantClaim('all')).toBe('all');
  });
  it('returns null for anything else, never "all"', () => {
    for (const raw of [undefined, null, 'ALL', ['1'], [0], [1, 1], {}, 7])
      expect(parseGrantClaim(raw)).toBeNull();
  });
});
