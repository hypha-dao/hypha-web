import { describe, expect, it } from 'vitest';

import {
  STALE_CONNECTION_MS,
  memberRowsForConnections,
  suggestConnections,
  unreadRoomsMissingFromMembers,
  type NewcomerCandidate,
} from '../member-connections';

type Person = Parameters<typeof memberRowsForConnections>[0][number];
type Room = Parameters<typeof memberRowsForConnections>[1][number];

function person(id: number, name: string, surname = ''): Person {
  return {
    id,
    name,
    surname,
    nickname: null,
    avatarUrl: null,
  } as Person;
}

function room(overrides: Partial<Room> & Pick<Room, 'roomId' | 'kind'>): Room {
  return {
    name: '',
    preview: '',
    mine: false,
    lastTs: null,
    unread: 0,
    memberCount: 2,
    otherUserId: null,
    ...overrides,
  };
}

describe('memberRowsForConnections', () => {
  it('lists connections and leaves signal rooms out', () => {
    const rows = memberRowsForConnections(
      [person(1, 'Edgar', 'Kampers'), person(2, 'Kate', 'Bennett')],
      [
        room({
          roomId: '!signal',
          kind: 'group',
          name: 'Local scale signal',
          preview: 'A signal update',
          memberCount: 6,
          lastTs: 500,
        }),
        room({
          roomId: '!stranger',
          kind: 'person',
          name: 'prod_privy_did_privy_cmp',
          otherUserId: '@stranger:matrix',
          preview: 'Not a connection',
          lastTs: 400,
        }),
        room({
          roomId: '!edgar-old',
          kind: 'person',
          name: 'Edgar Kampers',
          otherUserId: '@edgar:matrix',
          preview: 'Older note',
          lastTs: 100,
        }),
        room({
          roomId: '!edgar',
          kind: 'person',
          name: 'Edgar Kampers',
          otherUserId: '@edgar:matrix',
          preview: 'Recent note',
          lastTs: 300,
        }),
      ],
      { 1: '@edgar:matrix', 2: '@kate:matrix' },
      null,
      'Someone',
    );

    expect(rows.map((row) => row.name)).toEqual([
      'Edgar Kampers',
      'Kate Bennett',
    ]);
    expect(rows[0]).toMatchObject({
      roomId: '!edgar',
      preview: 'Recent note',
      lastTs: 300,
    });
    expect(rows[1]).toMatchObject({ roomId: null, preview: '' });
  });

  it('drops the signed-in member and the Hypha bot', () => {
    const rows = memberRowsForConnections(
      [
        person(7, 'Alex'),
        person(8, 'hypha_bot'),
        person(9, 'Vlad', 'Hramtsov'),
      ],
      [],
      {},
      7,
      'Someone',
    );

    expect(rows.map((row) => row.person.id)).toEqual([9]);
  });

  it('matches Matrix ids case-insensitively when attaching unread', () => {
    const rows = memberRowsForConnections(
      [person(1, 'Gerardo', 'Reza')],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          name: 'Gerardo Reza',
          otherUserId: '@Gerardo:matrix',
          preview: 'hello',
          unread: 1,
          lastTs: 10,
        }),
      ],
      { 1: '@gerardo:matrix' },
      null,
      'Someone',
    );

    expect(rows[0]).toMatchObject({
      roomId: '!dm',
      unread: 1,
      preview: 'hello',
    });
  });
});

describe('unreadRoomsMissingFromMembers', () => {
  it('surfaces unread DMs that are not in the loaded directory', () => {
    const directory = memberRowsForConnections(
      [person(1, 'Kate', 'Bennett')],
      [],
      { 1: '@kate:matrix' },
      null,
      'Someone',
    );
    const extras = unreadRoomsMissingFromMembers(
      [
        room({
          roomId: '!stranger',
          kind: 'person',
          name: 'Gerardo Reza',
          otherUserId: '@gerardo:matrix',
          preview: 'ping',
          unread: 1,
          lastTs: 50,
        }),
      ],
      directory,
      { 1: '@kate:matrix' },
    );

    expect(extras).toHaveLength(1);
    expect(extras[0]).toMatchObject({
      roomId: '!stranger',
      unread: 1,
      name: 'Gerardo Reza',
      preview: 'ping',
    });
  });

  it('skips unread rooms already attached to a listed member', () => {
    const directory = memberRowsForConnections(
      [person(1, 'Gerardo', 'Reza')],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          name: 'Gerardo Reza',
          otherUserId: '@gerardo:matrix',
          preview: 'ping',
          unread: 1,
          lastTs: 50,
        }),
      ],
      { 1: '@gerardo:matrix' },
      null,
      'Someone',
    );
    const extras = unreadRoomsMissingFromMembers(
      [
        room({
          roomId: '!dm',
          kind: 'person',
          name: 'Gerardo Reza',
          otherUserId: '@gerardo:matrix',
          preview: 'ping',
          unread: 1,
          lastTs: 50,
        }),
      ],
      directory,
      { 1: '@gerardo:matrix' },
    );

    expect(extras).toEqual([]);
  });
});

function member(
  id: number,
  name: string,
  lastTs: number | null,
  sharedSpaceCount: number,
) {
  return {
    person: {
      id,
      slug: null,
      name,
      surname: null,
      nickname: null,
      avatarUrl: null,
      sharedSpaceCount,
    },
    name,
    avatarUrl: undefined,
    roomId: lastTs == null ? null : `!${id}`,
    lastTs,
  };
}

describe('suggestConnections', () => {
  const now = Date.UTC(2026, 9, 14);

  it('keeps a stale conversation and adds people never met', () => {
    const picked = suggestConnections(
      [
        member(1, 'Edgar Kampers', now - STALE_CONNECTION_MS - 1, 1),
        member(2, 'Dmitry Ermolenko', null, 4),
        member(3, 'Kate Bennett', now - 60_000, 2),
      ],
      [
        {
          id: 9,
          name: 'Ada',
          spaceTitle: 'River school',
          spaceSlug: 'river-school',
          score: 5,
        },
      ],
      now,
    );

    expect(picked.map((card) => [card.name, card.kind])).toEqual([
      ['Ada', 'meet'],
      ['Edgar Kampers', 'reconnect'],
      ['Dmitry Ermolenko', 'reconnect'],
    ]);
    expect(picked[0]?.spaceTitle).toBe('River school');
    expect(picked.find((card) => card.name === 'Dmitry Ermolenko')?.kind).toBe(
      'reconnect',
    );
  });

  it('does not suggest someone who is already a connection', () => {
    const newcomer: NewcomerCandidate = {
      id: 2,
      name: 'Dmitry Ermolenko',
      spaceTitle: 'River school',
      spaceSlug: 'river-school',
      score: 9,
    };
    const picked = suggestConnections(
      [member(2, 'Dmitry Ermolenko', null, 1)],
      [newcomer, newcomer],
      now,
    );

    expect(picked).toHaveLength(1);
    expect(picked[0]?.kind).toBe('reconnect');
    expect(picked[0]?.key).toBe('person-2');
  });

  it('keeps people you already share a space with out of worth meeting', () => {
    const picked = suggestConnections(
      [member(1, 'Near', null, 3), member(2, 'Far', null, 1)],
      [],
      now,
    );

    expect(picked.map((card) => [card.name, card.kind])).toEqual([
      ['Near', 'reconnect'],
      ['Far', 'reconnect'],
    ]);
  });
});
