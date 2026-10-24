import { describe, expect, it } from 'vitest';

import { HYPHA_ROOM_TYPES } from '../../../../../core/src/matrix/room-types';

import {
  STALE_CONNECTION_MS,
  addablePeopleForGroup,
  connectionActivityTs,
  connectionMatchesPeopleSearch,
  conversationMatchesSearch,
  peopleMatchingSearch,
  conversationsMatchingSearch,
  membersForGroupPicker,
  conversationsVisibleInSection,
  conversationUnreadTotal,
  hiddenLegacyPairRoomIds,
  facesWithProfiles,
  groupRowsForConnections,
  isMessagesVisibleConversation,
  isPeopleListGroup,
  peopleAroundGroupRows,
  memberRowsForConnections,
  nextSelectedMembers,
  personRowsFromDmRooms,
  applyResolvedPeerTitles,
  resolvePeerRowTitle,
  conversationDisplayName,
  messagePreview,
  orphanedDirectRoomIds,
  previewWithNames,
  suggestConnections,
  supersededDirectRoomIds,
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

  it('keeps the directory person row even when a named group also exists', () => {
    const rows = memberRowsForConnections(
      [person(2, 'Kate', 'Bennett')],
      [
        room({
          roomId: '!legacy-group',
          kind: 'group',
          name: 'Vlad Hramtsov, Kate Bennett (test)',
          lastTs: null,
          otherUserId: '@kate:matrix',
        }),
      ],
      { 2: '@kate:matrix' },
      1,
      'Someone',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Kate Bennett',
      roomId: null,
      preview: '',
      lastTs: null,
    });
    expect(
      groupRowsForConnections(
        [
          room({
            roomId: '!legacy-group',
            kind: 'group',
            name: 'Vlad Hramtsov, Kate Bennett (test)',
            lastTs: null,
          }),
        ],
        'Someone',
      ).map((row) => row.name),
    ).toEqual([]);
  });

  it('does not use a signal thread as the private message', () => {
    const rows = memberRowsForConnections(
      [person(1, 'Edgar', 'Kampers')],
      [
        room({
          roomId: '!signal',
          kind: 'person',
          signalThread: true,
          name: 'Asset liquidity',
          otherUserId: '@edgar:matrix',
          preview: 'I just had a really good call',
          lastTs: 900,
        }),
        room({
          roomId: '!dm',
          kind: 'person',
          name: 'Edgar Kampers',
          otherUserId: '@edgar:matrix',
          preview: 'See you tomorrow',
          lastTs: 200,
        }),
      ],
      { 1: '@edgar:matrix' },
      null,
      'Someone',
    );

    expect(rows[0]).toMatchObject({
      roomId: '!dm',
      preview: 'See you tomorrow',
    });
  });

  it('leaves the private row empty when the only shared room is a signal', () => {
    const rows = memberRowsForConnections(
      [person(1, 'Edgar', 'Kampers')],
      [
        room({
          roomId: '!signal',
          kind: 'person',
          signalThread: true,
          otherUserId: '@edgar:matrix',
          preview: 'I just had a really good call',
          lastTs: 900,
        }),
      ],
      { 1: '@edgar:matrix' },
      null,
      'Someone',
    );

    expect(rows[0]).toMatchObject({ roomId: null, preview: '' });
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

describe('supersededDirectRoomIds', () => {
  it('keeps the later room for a person and returns the earlier one', () => {
    const losers = supersededDirectRoomIds([
      room({
        roomId: '!older',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@gerardo:matrix',
        lastTs: 10,
        unread: 4,
      }),
      room({
        roomId: '!later',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@Gerardo:matrix',
        lastTs: 20,
        unread: 1,
      }),
      room({
        roomId: '!group',
        kind: 'group',
        lastTs: 30,
        unread: 2,
      }),
    ]);

    expect(losers).toEqual(['!older']);
  });

  it('leaves a single direct room and signal threads alone', () => {
    const losers = supersededDirectRoomIds([
      room({
        roomId: '!only',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@kate:matrix',
        lastTs: 10,
        unread: 3,
      }),
      room({
        roomId: '!signal',
        kind: 'person',
        otherUserId: '@gerardo:matrix',
        lastTs: 5,
        unread: 2,
        signalThread: true,
      }),
    ]);

    expect(losers).toEqual([]);
  });

  it('keeps the typed DM even when an untyped leftover is newer', () => {
    const losers = supersededDirectRoomIds([
      room({
        roomId: '!legacy',
        kind: 'person',
        roomType: null,
        name: 'prod_privy_did_privy_gerardo',
        otherUserId: '@gerardo:matrix',
        lastTs: 90,
      }),
      room({
        roomId: '!dm',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        name: 'Gerardo Roza',
        otherUserId: '@gerardo:matrix',
        lastTs: 10,
      }),
    ]);
    expect(losers).toEqual(['!legacy']);
  });
});

describe('conversationUnreadTotal', () => {
  it('ignores unread on an earlier direct room for the same person', () => {
    const total = conversationUnreadTotal([
      room({
        roomId: '!older',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@gerardo:matrix',
        lastTs: 10,
        unread: 3,
      }),
      room({
        roomId: '!later',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@gerardo:matrix',
        lastTs: 20,
        unread: 0,
      }),
      room({
        roomId: '!kate',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@kate:matrix',
        lastTs: 15,
        unread: 1,
      }),
    ]);

    expect(total).toBe(1);
  });

  it('also drops membership-detected orphan rooms', () => {
    const total = conversationUnreadTotal(
      [
        room({
          roomId: '!older',
          kind: 'person',
          otherUserId: '@gerardo:matrix',
          lastTs: 10,
          unread: 3,
        }),
      ],
      ['!older'],
    );
    expect(total).toBe(0);
  });

  it('counts only rows Messages would show', () => {
    const total = conversationUnreadTotal([
      room({
        roomId: '!dm',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        otherUserId: '@kate:matrix',
        unread: 2,
      }),
      room({
        roomId: '!archived',
        kind: 'group',
        roomType: HYPHA_ROOM_TYPES.group,
        name: 'Old trio',
        unread: 4,
        archived: true,
      }),
      room({
        roomId: '!space-leak',
        kind: 'group',
        roomType: HYPHA_ROOM_TYPES.space,
        name: 'Hypha',
        unread: 5,
        memberCount: 40,
      }),
      room({
        roomId: '!legacy-dm',
        kind: 'person',
        roomType: null,
        otherUserId: '@old:matrix',
        unread: 3,
        signalThread: true,
      }),
    ]);
    expect(total).toBe(2);
  });
});

describe('isMessagesVisibleConversation', () => {
  it('keeps typed DMs and listed groups, drops archived and other types', () => {
    expect(
      isMessagesVisibleConversation(
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
        }),
      ),
    ).toBe(true);
    expect(
      isMessagesVisibleConversation(
        room({
          roomId: '!group',
          kind: 'group',
          roomType: HYPHA_ROOM_TYPES.group,
          name: 'Ada, Grace',
        }),
      ),
    ).toBe(true);
    expect(
      isMessagesVisibleConversation(
        room({
          roomId: '!archived',
          kind: 'group',
          roomType: HYPHA_ROOM_TYPES.group,
          archived: true,
        }),
      ),
    ).toBe(false);
    expect(
      isMessagesVisibleConversation(
        room({
          roomId: '!legacy',
          kind: 'group',
          name: 'Hypha',
          memberCount: 12,
        }),
      ),
    ).toBe(false);
    expect(
      isMessagesVisibleConversation(
        room({
          roomId: '!stale-person',
          kind: 'person',
          roomType: null,
          name: 'prod_privy_did_privy_abc',
          otherUserId: '@gerardo:matrix',
        }),
      ),
    ).toBe(false);
  });
});

describe('hiddenLegacyPairRoomIds', () => {
  it('hides an untyped 1:1 whose peer already has a typed DM', () => {
    const hidden = hiddenLegacyPairRoomIds([
      room({
        roomId: '!dm',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        name: 'Gerardo Roza',
        otherUserId: '@gerardo:matrix',
        preview: 'test',
        mine: true,
        lastTs: 20,
      }),
      room({
        roomId: '!legacy',
        kind: 'person',
        roomType: null,
        name: 'prod_privy_did_privy_gerardo',
        otherUserId: '@gerardo:matrix',
        preview: 'test',
        mine: true,
        lastTs: 10,
        memberCount: 2,
      }),
      room({
        roomId: '!named-pair',
        kind: 'group',
        name: 'prod_privy_did_privy_gerardo',
        otherUserId: '@gerardo:matrix',
        memberCount: 2,
        lastTs: 10,
      }),
    ]);
    expect(hidden).toEqual(expect.arrayContaining(['!legacy', '!named-pair']));
    expect(hidden).not.toContain('!dm');
  });
});

describe('orphanedDirectRoomIds', () => {
  it('keeps the remembered room when both pair rooms exist', () => {
    const orphans = orphanedDirectRoomIds(
      [
        {
          roomId: '!older',
          otherUserId: '@gerardo:matrix',
          lastTs: 50,
        },
        {
          roomId: '!later',
          otherUserId: '@Gerardo:matrix',
          lastTs: 20,
        },
      ],
      new Map([['@gerardo:matrix', '!later']]),
    );
    expect(orphans).toEqual(['!older']);
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
          roomType: HYPHA_ROOM_TYPES.dm,
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

describe('personRowsFromDmRooms', () => {
  it('lists a DM-typed room when the sender shares no space', () => {
    const rows = personRowsFromDmRooms(
      [person(1, 'Kate', 'Bennett')],
      [
        room({
          roomId: '!incoming',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Gerardo Reza',
          otherUserId: '@gerardo:matrix',
          preview: 'hello from elsewhere',
          unread: 0,
          lastTs: 80,
        }),
      ],
      { 1: '@kate:matrix' },
      null,
      'Someone',
    );

    expect(rows.map((row) => row.roomId)).toEqual(['!incoming', null]);
    expect(rows[0]).toMatchObject({
      name: 'Gerardo Reza',
      preview: 'hello from elsewhere',
      unread: 0,
    });
    expect(rows[1]).toMatchObject({ name: 'Kate Bennett', roomId: null });
  });

  it('attaches a directory profile to a DM-typed room', () => {
    const rows = personRowsFromDmRooms(
      [person(1, 'Gerardo', 'Reza')],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did',
          otherUserId: '@gerardo:matrix',
          preview: 'see you',
          unread: 2,
          lastTs: 10,
        }),
      ],
      { 1: '@gerardo:matrix' },
      null,
      'Someone',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      roomId: '!dm',
      name: 'Gerardo Reza',
      unread: 2,
      person: { id: 1 },
    });
  });

  it('does not build a person row from a legacy untyped room', () => {
    const rows = personRowsFromDmRooms(
      [person(1, 'Kate', 'Bennett')],
      [
        room({
          roomId: '!old',
          kind: 'group',
          name: 'Kate Bennett',
          otherUserId: '@kate:matrix',
          unread: 4,
          lastTs: 90,
        }),
      ],
      { 1: '@kate:matrix' },
      null,
      'Someone',
    );

    expect(rows.map((row) => row.roomId)).toEqual([null]);
    expect(rows[0]?.unread).toBe(0);
  });

  it('hides a named untyped 1:1 when the peer already has a typed DM', () => {
    const rows = personRowsFromDmRooms(
      [person(1, 'Gerardo', 'Roza')],
      [
        room({
          roomId: '!legacy',
          kind: 'person',
          roomType: null,
          name: 'prod_privy_did_privy_gerardo',
          otherUserId: '@gerardo:matrix',
          preview: 'test',
          mine: true,
          lastTs: 90,
        }),
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Gerardo Roza',
          otherUserId: '@gerardo:matrix',
          preview: 'test',
          mine: true,
          lastTs: 80,
        }),
      ],
      { 1: '@gerardo:matrix' },
      null,
      'Someone',
    );

    expect(rows.map((row) => row.roomId)).toEqual(['!dm']);
    expect(rows[0]).toMatchObject({ name: 'Gerardo Roza', roomId: '!dm' });
  });

  it('skips superseded rooms in the typedPeerHasHumanName first pass', () => {
    const rows = personRowsFromDmRooms(
      [] as Person[],
      [
        room({
          roomId: '!old',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Gerardo Roza',
          otherUserId: '@gerardo:matrix',
          preview: 'older',
          lastTs: 10,
          unread: 0,
        }),
        room({
          roomId: '!new',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_gerardo',
          otherUserId: '@gerardo:matrix',
          preview: 'newer',
          lastTs: 90,
          unread: 2,
        }),
      ],
      {},
      null,
      'Someone',
    );

    expect(rows.map((row) => row.roomId)).toEqual(['!new']);
    expect(rows[0]?.titlePending).toBe(true);
    expect(rows[0]?.name).toBe('');
    expect(rows[0]?.person.id).toBeLessThan(0);
  });

  it('does not use a raw Privy id as the row title', () => {
    const rows = personRowsFromDmRooms(
      [],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_cmjzxabc',
          otherUserId: '@prod_privy_did_privy_cmjzxabc:matrix',
          preview: 'You: test',
          mine: true,
          lastTs: 20,
        }),
      ],
      {},
      null,
      'Someone',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.titlePending).toBe(true);
    expect(rows[0]?.name).toBe('');
    expect(rows[0]?.name).not.toMatch(/privy|@prod_/i);
  });
});

describe('resolvePeerRowTitle', () => {
  it('keeps a human Matrix name and hides a raw Privy id', () => {
    expect(
      resolvePeerRowTitle({
        roomId: '!dm',
        name: 'Gerardo Roza',
        otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
      }),
    ).toEqual({ name: 'Gerardo Roza', titlePending: false });
    expect(
      conversationDisplayName(
        '@prod_privy_did_privy_cmjzx:matrix',
        'prod_privy_did_privy_cmjzx',
      ),
    ).toBeNull();
    expect(
      resolvePeerRowTitle({
        roomId: '!dm',
        name: 'prod_privy_did_privy_cmjzx',
        otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
      }),
    ).toEqual({ name: '', titlePending: true });
  });
});

describe('applyResolvedPeerTitles', () => {
  it('fills a pending DM title from the peer profile, never the raw id', () => {
    const pending = personRowsFromDmRooms(
      [],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_cmjzx',
          otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
          preview: 'You: test',
          mine: true,
          lastTs: 20,
        }),
      ],
      {},
      null,
      'Someone',
    );
    const resolved = applyResolvedPeerTitles(
      pending,
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_cmjzx',
          otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
        }),
      ],
      new Map([
        [
          'did:privy:cmjzx',
          { name: 'Gerardo', surname: 'Roza', nickname: null, slug: 'gerardo' },
        ],
      ]),
      {},
    );

    expect(resolved[0]).toMatchObject({
      name: 'Gerardo Roza',
      titlePending: false,
    });
    expect(resolved[0]?.name).not.toMatch(/privy/i);
  });

  it('keeps a skeleton while the peer profile is still loading', () => {
    const pending = personRowsFromDmRooms(
      [],
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_cmjzx',
          otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
        }),
      ],
      {},
      null,
      'Someone',
    );
    const resolved = applyResolvedPeerTitles(
      pending,
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_cmjzx',
          otherUserId: '@prod_privy_did_privy_cmjzx:matrix',
        }),
      ],
      new Map(),
      {},
      { loading: true, fallback: 'Someone' },
    );

    expect(resolved[0]).toMatchObject({ name: '', titlePending: true });
  });
});

describe('conversationsMatchingSearch', () => {
  it('keeps the needle when a selected chip is removed', () => {
    const ada = {
      person: person(1, 'Ada', 'Lovelace'),
      name: 'Ada Lovelace',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const grace = {
      person: person(2, 'Grace', 'Hopper'),
      name: 'Grace Hopper',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const selected = nextSelectedMembers(new Map(), ada);
    const afterRemove = nextSelectedMembers(selected, ada);
    expect(afterRemove.size).toBe(0);
    expect(
      conversationsMatchingSearch([ada, grace], 'ada').map((row) => row.name),
    ).toEqual(['Ada Lovelace']);
  });
});

describe('membersForGroupPicker', () => {
  it('excludes synthetic rows (id <= 0) in picker mode and keeps them otherwise', () => {
    const ada = {
      person: person(1, 'Ada', 'Lovelace'),
      name: 'Ada Lovelace',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const synthetic = {
      person: person(-4, 'Gerardo', 'Roza'),
      name: 'Gerardo Roza',
      preview: 'You: test',
      mine: true,
      lastTs: 20,
      unread: 0,
      roomId: '!dm',
    };
    const listed = [synthetic, ada];
    expect(
      conversationsMatchingSearch(membersForGroupPicker(listed, true), '').map(
        (row) => row.person.id,
      ),
    ).toEqual([1]);
    expect(
      conversationsMatchingSearch(membersForGroupPicker(listed, false), '').map(
        (row) => row.person.id,
      ),
    ).toEqual([-4, 1]);
  });
});

describe('nextSelectedMembers', () => {
  it('keeps earlier picks when the searched list changes', () => {
    const ada = {
      person: person(1, 'Ada', 'Lovelace'),
      name: 'Ada Lovelace',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const grace = {
      person: person(2, 'Grace', 'Hopper'),
      name: 'Grace Hopper',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const afterAda = nextSelectedMembers(new Map(), ada);
    const afterBoth = nextSelectedMembers(afterAda, grace);
    expect([...afterBoth.keys()]).toEqual([1, 2]);
    expect(afterBoth.get(1)?.name).toBe('Ada Lovelace');
    const afterSearchWouldHideAda = nextSelectedMembers(afterBoth, grace);
    expect([...afterSearchWouldHideAda.keys()]).toEqual([1]);
    expect(afterSearchWouldHideAda.get(1)?.name).toBe('Ada Lovelace');
  });

  it('does not select a synthetic DM row', () => {
    const synthetic = {
      person: person(-12, 'Gerardo', 'Roza'),
      name: 'Gerardo Roza',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: '!dm',
    };
    const ada = {
      person: person(1, 'Ada', 'Lovelace'),
      name: 'Ada Lovelace',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const afterAda = nextSelectedMembers(new Map(), ada);
    const afterSynthetic = nextSelectedMembers(afterAda, synthetic);
    expect([...afterSynthetic.keys()]).toEqual([1]);
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

  it('ignores a room that has no readable message', () => {
    expect(connectionActivityTs(Date.now(), '')).toBeNull();
    expect(connectionActivityTs(Date.now(), '  ')).toBeNull();
    expect(connectionActivityTs(50, 'Hello')).toBe(50);
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

describe('facesWithProfiles', () => {
  it('uses the Hypha photo when Matrix only has an id', () => {
    const faces = facesWithProfiles(
      [
        { name: '@gerardo:matrix', userId: '@Gerardo:matrix' },
        {
          name: '@vlad:matrix',
          userId: '@vlad:matrix',
          avatarUrl: 'https://matrix/v.png',
        },
      ],
      new Map([
        [
          '@gerardo:matrix',
          { name: 'Gerardo Roza', avatarUrl: 'https://hypha/g.png' },
        ],
        ['@vlad:matrix', { name: 'Vlad Hramtsov' }],
      ]),
    );

    expect(faces).toEqual([
      {
        name: 'Gerardo Roza',
        userId: '@Gerardo:matrix',
        avatarUrl: 'https://hypha/g.png',
      },
      {
        name: 'Vlad Hramtsov',
        userId: '@vlad:matrix',
        avatarUrl: 'https://matrix/v.png',
      },
    ]);
  });
});

describe('groupRowsForConnections', () => {
  it('keeps a group chat as one row with two member faces', () => {
    const rows = groupRowsForConnections(
      [
        room({
          roomId: '!trio',
          kind: 'group',
          name: 'Gerardo Roza, Vlad Hramtsov, Kate Bennett',
          faces: [
            { name: 'Gerardo Roza', avatarUrl: 'https://example/g.png' },
            { name: 'Vlad Hramtsov', avatarUrl: 'https://example/v.png' },
            { name: 'Kate Bennett' },
          ],
          preview: 'Hey guys',
          lastTs: 900,
          memberCount: 4,
        }),
        room({
          roomId: '!signal',
          kind: 'group',
          name: 'Local scale signal',
          signalThread: true,
          memberCount: 6,
        }),
        room({
          roomId: '!direct',
          kind: 'person',
          name: 'Kate Bennett',
          otherUserId: '@kate:matrix',
        }),
      ],
      'Someone',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Gerardo Roza, Vlad Hramtsov, Kate Bennett');
    expect(rows[0]?.roomId).toBe('!trio');
    expect(rows[0]?.faces).toEqual([
      { name: 'Gerardo Roza', avatarUrl: 'https://example/g.png' },
      { name: 'Vlad Hramtsov', avatarUrl: 'https://example/v.png' },
    ]);
    expect(rows[0]?.person.id).toBeLessThan(0);
  });

  it('leaves a space channel out of the people list', () => {
    const rows = groupRowsForConnections(
      [
        room({
          roomId: '!space',
          kind: 'group',
          name: 'Hypha',
          roomType: HYPHA_ROOM_TYPES.space,
          memberCount: 40,
          lastTs: 900,
        }),
      ],
      'Someone',
    );

    expect(rows).toEqual([]);
  });

  it('fills the second face from the room title when only one portrait is known', () => {
    const rows = groupRowsForConnections(
      [
        room({
          roomId: '!pair',
          kind: 'group',
          name: 'Gerardo Roza, Vlad Hramtsov',
          faces: [{ name: 'Gerardo Roza', avatarUrl: 'https://example/g.png' }],
          memberCount: 3,
        }),
      ],
      'Someone',
    );

    expect(rows[0]?.faces).toEqual([
      { name: 'Gerardo Roza', avatarUrl: 'https://example/g.png' },
      { name: 'Vlad Hramtsov' },
    ]);
  });

  it('returns people by name and username, not only existing rooms', () => {
    const kate = {
      ...person(2, 'Kate', 'Bennett'),
      nickname: 'kate',
      slug: 'kate-bennett',
    };
    const xerxes = {
      ...person(9, 'Xerxes', 'Potel'),
      nickname: 'xpotel',
      slug: 'xerxes',
    };
    expect(connectionMatchesPeopleSearch(xerxes, 'xerxes')).toBe(true);
    expect(connectionMatchesPeopleSearch(xerxes, 'xpotel')).toBe(true);
    expect(
      connectionMatchesPeopleSearch(
        {
          name: 'Vlad',
          surname: 'Hramtsov',
          nickname: 'vlad-hramtsov',
          slug: 'vlad-hramtsov',
        },
        'vladhram',
      ),
    ).toBe(true);
    expect(
      peopleMatchingSearch([kate], [xerxes], 'xerxes').map((p) => p.id),
    ).toEqual([9]);
    expect(
      peopleMatchingSearch([kate, xerxes], [], 'bennett').map((p) => p.id),
    ).toEqual([2]);
  });

  it('does not treat a missing mxid as already in the group', () => {
    const kate = {
      ...person(2, 'Kate', 'Bennett'),
      nickname: 'kate',
      slug: 'kate-bennett',
    };
    const xerxes = {
      ...person(9, 'Xerxes', 'Potel'),
      nickname: 'xpotel',
      slug: 'xerxes',
    };
    expect(
      addablePeopleForGroup(
        [kate, xerxes],
        [],
        { 2: '@kate:matrix' },
        new Set(['@kate:matrix']),
        'xerxes',
      ).map((p) => p.id),
    ).toEqual([9]);
    expect(
      addablePeopleForGroup(
        [kate],
        [xerxes],
        {},
        new Set(['@someone:matrix']),
        'xerxes',
      ).map((p) => p.id),
    ).toEqual([9]);
  });

  it('finds a renamed group by a member name in the title or faces', () => {
    const row = room({
      roomId: '!pair',
      kind: 'group',
      name: 'Vlad Hramtsov, Kate Bennett (test)',
      faces: [{ name: 'Vlad Hramtsov' }, { name: 'Kate Bennett' }],
      memberCount: 2,
    });
    expect(conversationMatchesSearch(row, 'Kate')).toBe(true);
    expect(
      conversationMatchesSearch({ ...row, name: 'Water team' }, 'Kate'),
    ).toBe(true);
    expect(conversationMatchesSearch(row, 'Marieke')).toBe(false);
    expect(
      conversationMatchesSearch(
        {
          ...row,
          name: 'Water team',
          searchMembers: [
            { name: 'Marieke Visser', nickname: 'marie', slug: 'marieke' },
          ],
        },
        'Marieke',
      ),
    ).toBe(true);
    expect(
      conversationMatchesSearch(
        {
          ...row,
          name: 'Water team',
          searchMembers: [
            { name: 'Marieke Visser', nickname: 'marie', slug: 'marieke' },
          ],
        },
        'marie',
      ),
    ).toBe(true);
    expect(
      conversationMatchesSearch(
        {
          ...row,
          name: 'Water team',
          searchMembers: [
            {
              name: 'Vlad Hramtsov',
              nickname: 'vlad-hramtsov',
              slug: 'vlad-hramtsov',
            },
          ],
        },
        'vladhram',
      ),
    ).toBe(true);
  });

  it('keeps a renamed two-person group without a comma in the title', () => {
    const row = room({
      roomId: '!pair',
      kind: 'group',
      name: 'Water team',
      memberCount: 2,
      roomType: HYPHA_ROOM_TYPES.group,
    });
    expect(isPeopleListGroup(row)).toBe(true);
    expect(groupRowsForConnections([row], 'Someone')).toHaveLength(1);
    expect(groupRowsForConnections([row], 'Someone')[0]?.name).toBe(
      'Water team',
    );
  });

  it('hides an untyped named 1:1 leftover next to a typed DM', () => {
    const rows = groupRowsForConnections(
      [
        room({
          roomId: '!dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Gerardo Roza',
          otherUserId: '@gerardo:matrix',
        }),
        room({
          roomId: '!legacy-pair',
          kind: 'group',
          name: 'prod_privy_did_privy_gerardo',
          otherUserId: '@gerardo:matrix',
          memberCount: 2,
          groupChat: true,
        }),
      ],
      'Someone',
    );
    expect(rows.map((row) => row.roomId)).toEqual([]);
    expect(
      isPeopleListGroup(
        room({
          roomId: '!legacy-pair',
          kind: 'group',
          name: 'prod_privy_did_privy_gerardo',
          otherUserId: '@gerardo:matrix',
          memberCount: 2,
          groupChat: true,
        }),
      ),
    ).toBe(false);
  });

  it('lists a named untyped group when only one member has loaded', () => {
    const rows = peopleAroundGroupRows(
      [
        {
          roomId: '!Cm2va52o4xgesz0V:srv1294735.hstgr.cloud',
          name: 'Gerardo Roza, Xerxes Potel, Vlad Hramtsov (test)',
          roomType: null,
          loadedHumanCount: 1,
          summaryJoinedCount: 4,
          hasRoomName: true,
        },
      ],
      'Someone',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.roomId).toBe('!Cm2va52o4xgesz0V:srv1294735.hstgr.cloud');
  });

  it('keeps a remembered renamed group and drops untyped proposal or space rooms', () => {
    const rows = peopleAroundGroupRows(
      [
        {
          roomId: '!team',
          name: 'Team Alpha',
          roomType: null,
          loadedHumanCount: 1,
          summaryJoinedCount: 4,
          hasRoomName: true,
          groupChat: true,
        },
        {
          roomId: '!Cm2va52o4xgesz0V:srv1294735.hstgr.cloud',
          name: 'Gerardo Roza, Xerxes Potel, Vlad Hramtsov (test)',
          roomType: null,
          loadedHumanCount: 1,
          summaryJoinedCount: 4,
          hasRoomName: true,
        },
        {
          roomId: '!proposal',
          name: 'Proposal discussion',
          loadedHumanCount: 12,
          summaryJoinedCount: 12,
          hasRoomName: true,
        },
        {
          roomId: '!space',
          name: 'space-hypha',
          loadedHumanCount: 40,
          summaryJoinedCount: 40,
          hasRoomName: true,
        },
      ],
      'Someone',
    );
    expect(rows.map((row) => row.roomId)).toEqual([
      '!team',
      '!Cm2va52o4xgesz0V:srv1294735.hstgr.cloud',
    ]);
  });

  it('hides untyped proposal, space, and signal rooms that production hid', () => {
    const rows = peopleAroundGroupRows(
      [
        {
          roomId: '!proposal',
          name: 'Proposal discussion',
          loadedHumanCount: 12,
          summaryJoinedCount: 12,
          hasRoomName: true,
        },
        {
          roomId: '!space',
          name: 'space-hypha',
          loadedHumanCount: 40,
          summaryJoinedCount: 40,
          hasRoomName: true,
        },
        {
          roomId: '!signal',
          name: 'Signals upvote feature',
          loadedHumanCount: 8,
          summaryJoinedCount: 8,
          hasRoomName: true,
        },
        {
          roomId: '!redesign',
          name: 'Signal Redesign',
          loadedHumanCount: 6,
          summaryJoinedCount: 6,
          hasRoomName: true,
        },
        {
          roomId: '!cal',
          name: 'Calendar…',
          loadedHumanCount: 5,
          summaryJoinedCount: 5,
          hasRoomName: true,
        },
      ],
      'Someone',
    );
    expect(rows).toEqual([]);
  });

  it('keeps archived groups so the Archived view can list them', () => {
    const row = room({
      roomId: '!old',
      kind: 'group',
      name: 'Water team',
      archived: true,
      memberCount: 3,
      groupChat: true,
    });
    const rows = groupRowsForConnections([row], 'Someone');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.archived).toBe(true);
    expect(conversationsVisibleInSection(rows, 'messages')).toEqual([]);
    expect(conversationsVisibleInSection(rows, 'archived')).toHaveLength(1);
  });
});

const GERARDO =
  '@prod_privy_did_privy_cmceozhp9017hjx0mjq0aets5:matrix.example';

describe('messagePreview', () => {
  it('keeps a privy mention id so a later pass can match the person', () => {
    expect(messagePreview(`Hey ${GERARDO}`)).toBe(`Hey ${GERARDO}`);
  });

  it('uses the room member name when Matrix already has one', () => {
    expect(
      messagePreview(`Hey ${GERARDO}`, (id) =>
        id === GERARDO ? 'Gerardo Roza' : '',
      ),
    ).toBe('Hey @Gerardo Roza');
  });

  it('keeps a technical member label so a later pass can replace the mxid', () => {
    expect(
      messagePreview(`Hey ${GERARDO}`, (id) => (id === GERARDO ? GERARDO : '')),
    ).toBe(`Hey ${GERARDO}`);
  });

  it('still shortens an ordinary mention and a long note', () => {
    expect(messagePreview('See you @alice:matrix.org')).toBe('See you @alice');
    const long = messagePreview(`${'word '.repeat(20).trimEnd()}`);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(48);
  });
});

describe('previewWithNames', () => {
  it('shows the person name instead of the privy id', () => {
    const names = new Map<string, string>([
      [GERARDO.toLowerCase(), 'Gerardo Roza'],
    ]);
    expect(previewWithNames(`Hey ${GERARDO}`, names)).toBe('Hey @Gerardo Roza');
  });

  it('matches a bare privy localpart', () => {
    const local = GERARDO.slice(1, GERARDO.indexOf(':'));
    const names = new Map<string, string>([
      [local.toLowerCase(), 'Vlad Hramtsov'],
    ]);
    expect(previewWithNames(`You wrote @${local}`, names)).toBe(
      'You wrote @Vlad Hramtsov',
    );
  });
});
