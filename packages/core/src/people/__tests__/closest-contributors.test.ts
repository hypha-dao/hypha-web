import { describe, expect, it } from 'vitest';

import {
  findNamedDirectRoomId,
  messageCountsByMatrixUser,
  messageCountsByPersonId,
  rankClosestContributors,
} from '../closest-contributors';

const self = '@ada:hypha';

describe('messageCountsByMatrixUser', () => {
  it('counts every loaded message in a two-person room toward the other person', () => {
    const counts = messageCountsByMatrixUser(
      [
        {
          joinedUserIds: [self, '@bea:hypha'],
          messageSenderIds: [self, '@bea:hypha', self],
        },
      ],
      self,
    );
    expect(counts.get('@bea:hypha')).toBe(3);
    expect(counts.has(self)).toBe(false);
  });

  it('counts only other senders in a larger room', () => {
    const counts = messageCountsByMatrixUser(
      [
        {
          joinedUserIds: [self, '@bea:hypha', '@cam:hypha'],
          messageSenderIds: [self, '@bea:hypha', '@bea:hypha', '@cam:hypha'],
        },
      ],
      self,
    );
    expect(counts.get('@bea:hypha')).toBe(2);
    expect(counts.get('@cam:hypha')).toBe(1);
  });

  it('ignores rooms with no loaded messages', () => {
    const counts = messageCountsByMatrixUser(
      [
        {
          joinedUserIds: [self, '@bea:hypha'],
          messageSenderIds: [],
        },
      ],
      self,
    );
    expect(counts.size).toBe(0);
  });
});

describe('messageCountsByPersonId', () => {
  it('drops Matrix users who are not a known person', () => {
    const counts = messageCountsByPersonId(
      new Map([
        ['@bea:hypha', 4],
        ['@stranger:hypha', 9],
      ]),
      { 2: '@bea:hypha' },
    );
    expect([...counts.entries()]).toEqual([[2, 4]]);
  });
});

describe('rankClosestContributors', () => {
  const people = [
    { id: 2, sharedSpaceCount: 3 },
    { id: 3, sharedSpaceCount: 1 },
    { id: 4, sharedSpaceCount: 2 },
  ];

  it('uses shared spaces when nobody has a loaded message', () => {
    const ranked = rankClosestContributors(people, new Map(), 2);
    expect(ranked.basis).toBe('sharedSpaces');
    expect(ranked.people.map((person) => person.id)).toEqual([2, 4]);
  });

  it('ranks people who have loaded messages ahead of shared spaces', () => {
    const ranked = rankClosestContributors(
      people,
      new Map([
        [3, 1],
        [4, 5],
      ]),
      8,
    );
    expect(ranked.basis).toBe('messages');
    expect(ranked.people.map((person) => person.id)).toEqual([4, 3]);
  });

  it('breaks message ties by shared spaces, then id', () => {
    const ranked = rankClosestContributors(
      people,
      new Map([
        [3, 2],
        [4, 2],
      ]),
    );
    expect(ranked.people.map((person) => person.id)).toEqual([4, 3]);
  });
});

describe('findNamedDirectRoomId', () => {
  it('returns the two-person room already named for that person', () => {
    expect(
      findNamedDirectRoomId(
        [
          {
            roomId: '!space:hypha',
            name: 'Hypha',
            joinedUserIds: [self, '@bea:hypha'],
          },
          {
            roomId: '!dm:hypha',
            name: 'Bea',
            joinedUserIds: [self, '@bea:hypha'],
          },
        ],
        self,
        '@bea:hypha',
        'Bea',
      ),
    ).toBe('!dm:hypha');
  });

  it('does not treat a larger room as a direct chat', () => {
    expect(
      findNamedDirectRoomId(
        [
          {
            roomId: '!group:hypha',
            name: 'Bea',
            joinedUserIds: [self, '@bea:hypha', '@cam:hypha'],
          },
        ],
        self,
        '@bea:hypha',
        'Bea',
      ),
    ).toBeNull();
  });
});
