import { describe, expect, it } from 'vitest';

import {
  presenceFromMatrixStatus,
  presenceRank,
  sortByPresenceThenShared,
  sortByRecencyThenPresence,
} from '../member-presence';

describe('presenceFromMatrixStatus', () => {
  it('maps Matrix online to active', () => {
    expect(presenceFromMatrixStatus({ presence: 'online' })).toBe('active');
    expect(
      presenceFromMatrixStatus({ presence: 'online', currently_active: true }),
    ).toBe('active');
  });

  it('maps unavailable and inactive online to idle', () => {
    expect(presenceFromMatrixStatus({ presence: 'unavailable' })).toBe('idle');
    expect(
      presenceFromMatrixStatus({
        presence: 'online',
        currently_active: false,
      }),
    ).toBe('idle');
  });

  it('maps offline and unknown to offline', () => {
    expect(presenceFromMatrixStatus({ presence: 'offline' })).toBe('offline');
    expect(presenceFromMatrixStatus({})).toBe('offline');
  });
});

describe('sort helpers', () => {
  it('puts active people before idle and offline', () => {
    const presence = new Map([
      [1, 'offline' as const],
      [2, 'active' as const],
      [3, 'idle' as const],
    ]);
    const ranked = sortByPresenceThenShared(
      [
        { id: 1, sharedSpaceCount: 99 },
        { id: 2, sharedSpaceCount: 1 },
        { id: 3, sharedSpaceCount: 50 },
      ],
      presence,
    );
    expect(ranked.map((person) => person.id)).toEqual([2, 3, 1]);
  });

  it('keeps latest messages first on the connections list', () => {
    const presence = new Map([
      [1, 'offline' as const],
      [2, 'active' as const],
    ]);
    const ranked = sortByRecencyThenPresence(
      [
        {
          person: { id: 1 },
          name: 'Offline recent',
          lastTs: 200,
        },
        {
          person: { id: 2 },
          name: 'Active older',
          lastTs: 100,
        },
      ],
      presence,
    );
    expect(ranked.map((row) => row.person.id)).toEqual([1, 2]);
    expect(presenceRank('active')).toBeLessThan(presenceRank('idle'));
  });
});
