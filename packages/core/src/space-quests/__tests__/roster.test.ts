import { describe, expect, it } from 'vitest';
import { offRosterQuestPersonIds } from '../roster';

describe('offRosterQuestPersonIds', () => {
  it('allows new person IDs that are on the space roster', () => {
    expect(
      offRosterQuestPersonIds([7, 8, null], new Set([7, 8, 9]), new Set()),
    ).toEqual([]);
  });

  it('rejects newly assigned IDs that are not on the roster', () => {
    expect(offRosterQuestPersonIds([7, 99], new Set([7]), new Set())).toEqual([
      99,
    ]);
  });

  it('preserves already-saved outsider IDs when they are not newly assigned', () => {
    expect(
      offRosterQuestPersonIds([42, 7], new Set([7]), new Set([42])),
    ).toEqual([]);
  });

  it('ignores null, non-positive, and duplicate IDs', () => {
    expect(
      offRosterQuestPersonIds(
        [null, undefined, 0, -1, 7, 7],
        new Set([7]),
        new Set(),
      ),
    ).toEqual([]);
  });
});
