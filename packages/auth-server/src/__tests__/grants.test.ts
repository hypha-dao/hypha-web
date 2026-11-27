import { describe, it, expect } from 'vitest';
import {
  GrantError,
  MAX_SPACE_GRANTS,
  initialSpaceChoice,
  parseGrantClaim,
  parseGrantInput,
} from '../grants';

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

describe('initialSpaceChoice (where the consent picker starts)', () => {
  it('a new connection and a stored "all" start on "All my spaces", as before', () => {
    expect(initialSpaceChoice(null, [1, 2])).toEqual({
      mode: 'all',
      chosen: [1, 2],
      keptUnlisted: false,
    });
    expect(initialSpaceChoice('all', null)).toEqual({
      mode: 'all',
      chosen: [],
      keptUnlisted: false,
    });
  });

  it('a stored list starts on exactly that list, never on "all"', () => {
    expect(initialSpaceChoice([2], [1, 2, 3])).toEqual({
      mode: 'spaces',
      chosen: [2],
      keptUnlisted: false,
    });
  });

  it('spaces the person can no longer pick are left out (narrower only)', () => {
    expect(initialSpaceChoice([2, 9], [1, 2, 3])).toEqual({
      mode: 'spaces',
      chosen: [2],
      keptUnlisted: false,
    });
    expect(initialSpaceChoice([9], [1]).chosen).toEqual([]);
  });

  it('when the spaces cannot be loaded, the stored list is kept rather than widened', () => {
    expect(initialSpaceChoice([4, 5], null)).toEqual({
      mode: 'spaces',
      chosen: [4, 5],
      keptUnlisted: true,
    });
  });
});
