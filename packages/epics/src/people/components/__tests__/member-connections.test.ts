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
  listedConversationIsOpen,
  listedConversationOpenTarget,
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
  resolvedMatrixIdsForGroup,
  personRowsFromDmRooms,
  applyResolvedPeerTitles,
  mergeDirectoryPeople,
  resolvePeerRowTitle,
  conversationDisplayName,
  visibleMemberRowsAfterTitleResolve,
  messagesPeopleListReady,
  messagePreview,
  previewForInboxDisplay,
  senderFirstName,
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
  it('keeps the newest room when an older one is the remembered room', () => {
    const orphans = orphanedDirectRoomIds(
      [
        {
          roomId: '!current',
          otherUserId: '@gerardo:matrix',
          lastTs: 50,
        },
        {
          roomId: '!remembered',
          otherUserId: '@Gerardo:matrix',
          lastTs: 20,
        },
      ],
      new Map([['@gerardo:matrix', '!remembered']]),
    );
    expect(orphans).toEqual(['!remembered']);
  });

  it('keeps the remembered room when it is tied for newest', () => {
    const orphans = orphanedDirectRoomIds(
      [
        {
          roomId: '!other',
          otherUserId: '@gerardo:matrix',
          lastTs: 50,
        },
        {
          roomId: '!remembered',
          otherUserId: '@Gerardo:matrix',
          lastTs: 50,
        },
      ],
      new Map([['@gerardo:matrix', '!remembered']]),
    );
    expect(orphans).toEqual(['!other']);
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

  it('does not attach a unique-name room when the person has a different MXID', () => {
    const rows = personRowsFromDmRooms(
      [person(7, 'Basil', 'Childers')],
      [
        room({
          roomId: '!other',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Basil Childers',
          otherUserId: '@someone-else:matrix',
          preview: '',
          lastTs: null,
        }),
      ],
      { 7: '@basil:matrix' },
      null,
      'Someone',
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      roomId: '!other',
      name: 'Basil Childers',
    });
    expect(rows[0]?.person.id).not.toBe(7);
    expect(rows[1]).toMatchObject({
      person: { id: 7 },
      roomId: null,
    });
  });

  it('does not treat a duplicate name as unique after one person is used', () => {
    const rows = personRowsFromDmRooms(
      [person(7, 'Basil', 'Childers'), person(8, 'Basil', 'Childers')],
      [
        room({
          roomId: '!first',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Basil Childers',
          otherUserId: '@basil-one:matrix',
          preview: 'hi',
          lastTs: 10,
        }),
        room({
          roomId: '!second',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Basil Childers',
          otherUserId: '@basil-two:matrix',
          preview: '',
          lastTs: null,
        }),
      ],
      { 7: '@basil-one:matrix' },
      null,
      'Someone',
    );

    const attached = rows.filter((row) => row.person.id === 7);
    expect(attached).toHaveLength(1);
    expect(attached[0]).toMatchObject({ roomId: '!first' });
    expect(
      rows.some((row) => row.person.id === 8 && row.roomId === '!second'),
    ).toBe(false);
  });

  it('attaches an empty typed DM to the directory person by unique name', () => {
    const rows = personRowsFromDmRooms(
      [person(7, 'Basil', 'Childers')],
      [
        room({
          roomId: '!empty',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'Basil Childers',
          otherUserId: '@prod_privy_did_privy_basil:matrix',
          preview: '',
          lastTs: null,
        }),
      ],
      {},
      null,
      'Someone',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      roomId: '!empty',
      name: 'Basil Childers',
      person: { id: 7 },
    });
  });

  it('attaches a directory profile from peopleBySub without a matrix-id map', () => {
    const rows = personRowsFromDmRooms(
      [person(7, 'Basil', 'Childers'), person(2, 'Kate', 'Bennett')],
      [
        room({
          roomId: '!basil',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_basil',
          otherUserId: '@prod_privy_did_privy_basil:matrix',
          preview: 'Hey @Basil Childers',
          mine: true,
          lastTs: 20,
        }),
      ],
      {},
      null,
      'Someone',
      undefined,
      new Map([
        [
          'did:privy:basil',
          {
            id: 7,
            name: 'Basil',
            surname: 'Childers',
            nickname: null,
            slug: 'basil',
          },
        ],
      ]),
    );

    expect(rows.map((row) => row.roomId)).toEqual(['!basil', null]);
    expect(rows[0]).toMatchObject({
      roomId: '!basil',
      name: 'Basil Childers',
      preview: 'Hey @Basil Childers',
      person: { id: 7 },
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

  it('attaches a directory person id from the peer profile', () => {
    const pending = personRowsFromDmRooms(
      [] as Person[],
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
      new Map([
        [
          'did:privy:cmjzx',
          {
            id: 42,
            name: 'Gerardo',
            surname: 'Roza',
            nickname: null,
            slug: 'gerardo',
          },
        ],
      ]),
      {},
    );

    expect(resolved[0]).toMatchObject({
      name: 'Gerardo Roza',
      titlePending: false,
      person: { id: 42 },
    });
  });

  it('keeps an unresolved DM pending after settle so it can be hidden', () => {
    const pending = personRowsFromDmRooms(
      [] as Person[],
      [
        room({
          roomId: '!empty-dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_unknown',
          otherUserId: '@prod_privy_did_privy_unknown:matrix',
          preview: '',
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
          roomId: '!empty-dm',
          kind: 'person',
          roomType: HYPHA_ROOM_TYPES.dm,
          name: 'prod_privy_did_privy_unknown',
          otherUserId: '@prod_privy_did_privy_unknown:matrix',
        }),
      ],
      new Map(),
      {},
      { hideUnresolved: true },
    );

    expect(resolved[0]).toMatchObject({ name: '', titlePending: true });
    expect(
      visibleMemberRowsAfterTitleResolve(resolved, false).map(
        (row) => row.roomId,
      ),
    ).toEqual([]);
    expect(
      visibleMemberRowsAfterTitleResolve(resolved, true).map(
        (row) => row.roomId,
      ),
    ).toEqual(['!empty-dm']);
  });

  it('keeps a directory name when the person has no mapped mxid', () => {
    const bob = {
      person: person(42, 'Bob', 'Duindam'),
      name: 'Bob Duindam',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const resolved = applyResolvedPeerTitles([bob], [], new Map(), {});

    expect(resolved[0]).toMatchObject({
      name: 'Bob Duindam',
      titlePending: false,
    });
  });
});

describe('messagesPeopleListReady', () => {
  const ready = {
    isMatrixAvailable: true,
    isConnecting: false,
    synced: true,
    initialSyncComplete: true,
    rowsPending: false,
    homeLoaded: true,
    matrixIdsLoading: false,
    peopleBySubLoading: false,
  };

  it('waits while Matrix is connecting or the room list has not settled', () => {
    expect(
      messagesPeopleListReady({
        ...ready,
        isMatrixAvailable: false,
        isConnecting: true,
        synced: false,
        initialSyncComplete: false,
        rowsPending: true,
        homeLoaded: false,
      }),
    ).toBe(false);
    expect(messagesPeopleListReady({ ...ready, synced: false })).toBe(false);
    expect(messagesPeopleListReady({ ...ready, rowsPending: true })).toBe(
      false,
    );
  });

  it('does not treat Syncing-without-Prepared as ready (directory flash)', () => {
    expect(
      messagesPeopleListReady({ ...ready, initialSyncComplete: false }),
    ).toBe(false);
  });

  it('waits for directory, Matrix ids, and peer profiles so the set of people does not swap', () => {
    expect(messagesPeopleListReady({ ...ready, homeLoaded: false })).toBe(
      false,
    );
    expect(messagesPeopleListReady({ ...ready, matrixIdsLoading: true })).toBe(
      false,
    );
    expect(
      messagesPeopleListReady({ ...ready, peopleBySubLoading: true }),
    ).toBe(false);
    expect(messagesPeopleListReady(ready)).toBe(true);
  });

  it('is ready when Matrix is unavailable so the empty copy can show', () => {
    expect(
      messagesPeopleListReady({
        ...ready,
        isMatrixAvailable: false,
        synced: false,
        initialSyncComplete: false,
        rowsPending: true,
        homeLoaded: false,
      }),
    ).toBe(true);
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

  it('matches a directory person by given name when the row title is pending', () => {
    const bob = {
      person: person(42, 'Bob', 'Duindam'),
      name: '',
      titlePending: true,
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    expect(conversationMatchesSearch(bob, 'Bob')).toBe(true);
    expect(conversationsMatchingSearch([bob], 'Bob')).toHaveLength(1);
  });
});

describe('mergeDirectoryPeople', () => {
  it('unions paged connections with later search hits by id', () => {
    const firstPage = [person(1, 'Ada', 'Lovelace')];
    const later = [person(42, 'Bob', 'Duindam'), person(1, 'Ada', 'Lovelace')];
    expect(
      mergeDirectoryPeople(firstPage, later, null).map((row) => row.id),
    ).toEqual([1, 42]);
    expect(
      peopleMatchingSearch(
        mergeDirectoryPeople(firstPage, later),
        [],
        'Bob',
      ).map((row) => row.id),
    ).toEqual([42]);
  });
});

describe('membersForGroupPicker', () => {
  it('keeps directory connections with no room (positive id) in the picker', () => {
    const bob = {
      person: person(42, 'Bob', 'Duindam'),
      name: 'Bob Duindam',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const dannie = {
      person: person(43, 'Dannie', 'Quilitzsch'),
      name: 'Dannie Quilitzsch',
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: null,
    };
    const synthetic = {
      person: person(-4, '', ''),
      name: '',
      titlePending: true,
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      roomId: '!empty-dm',
    };
    expect(
      membersForGroupPicker([bob, dannie, synthetic], true).map(
        (row) => row.person.id,
      ),
    ).toEqual([42, 43]);
  });

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

describe('resolvedMatrixIdsForGroup', () => {
  it('returns null until every selected member has a Matrix id', () => {
    const ada = { person: person(1, 'Ada', 'Lovelace') };
    const grace = { person: person(2, 'Grace', 'Hopper') };
    expect(
      resolvedMatrixIdsForGroup([ada, grace], { 1: '@ada:matrix' }),
    ).toBeNull();
    expect(
      resolvedMatrixIdsForGroup([ada, grace], {
        1: '  @ada:matrix  ',
        2: '@grace:matrix',
      }),
    ).toEqual(['@ada:matrix', '@grace:matrix']);
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

  it('opens listed DMs and groups by room id without creating', () => {
    expect(
      listedConversationOpenTarget({
        roomId: '!dm',
        name: 'Joachim Stroh',
        person: { id: 12, slug: 'joachim' },
      }),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!dm',
      title: 'Joachim Stroh',
      peerSlug: 'joachim',
    });
    expect(
      listedConversationOpenTarget({
        roomId: '!group',
        name: 'Alex Prate/Joachim',
        person: { id: -4, slug: null },
      }),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!group',
      title: 'Alex Prate/Joachim',
      peerSlug: null,
    });
  });

  it('keeps the open row when the joined room id is not the one stored on the row', () => {
    const ronnie = {
      roomId: '!stale',
      name: 'Ronnie Xerxes Potel',
      person: { id: 4 },
    };
    expect(
      listedConversationIsOpen(ronnie, { roomId: '!live', personId: 4 }),
    ).toBe(true);
    expect(
      listedConversationIsOpen(
        { roomId: '!live', name: 'Ronnie Xerxes Potel', person: { id: 4 } },
        { roomId: '!live', personId: null },
      ),
    ).toBe(true);
    expect(
      listedConversationIsOpen(
        { roomId: '!other', name: 'Marieke Post', person: { id: 5 } },
        { roomId: '!live', personId: 4 },
      ),
    ).toBe(false);
    expect(
      listedConversationIsOpen(
        { roomId: '!group', name: 'Core Hypha Team', person: { id: -8 } },
        { roomId: '!group', personId: 4 },
      ),
    ).toBe(true);
  });

  it('only ensures a person room when the list row has no room yet', () => {
    expect(
      listedConversationOpenTarget({
        roomId: null,
        name: 'Ada Lovelace',
        person: { id: 1, slug: 'ada' },
      }),
    ).toEqual({ kind: 'ensure-person' });
    expect(
      listedConversationOpenTarget({
        roomId: '',
        name: 'Unknown',
        person: { id: -8, slug: null },
      }),
    ).toBeNull();
  });

  it('recovers a listed DM when the row has a preview but no roomId yet', () => {
    const rooms = [
      room({
        roomId: '!basil',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        name: 'Basil Childers',
        otherUserId: '@prod_privy_did_privy_basil:matrix',
        preview: 'Hey @Basil Childers',
        mine: true,
        lastTs: 20,
      }),
    ];
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Basil Childers',
          preview: 'Hey @Basil Childers',
          lastTs: 20,
          person: { id: 7, slug: 'basil' },
        },
        {
          rooms,
          peopleBySub: new Map([['did:privy:basil', { id: 7 }]]),
        },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!basil',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Vladramtsovoy',
          preview: 'So I think you need to tell AI…',
          lastTs: 10,
          person: { id: 9, slug: 'vlad' },
        },
        {
          rooms,
          personIdToMatrixUserId: { 9: '@vlad:matrix' },
        },
      ),
    ).toBeNull();
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Basil Childers',
          preview: 'Hey @Basil Childers',
          lastTs: 20,
          person: { id: 7, slug: 'basil' },
        },
        { rooms },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!basil',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
  });

  it('opens an empty listed DM by unique name or remembered room', () => {
    const rooms = [
      room({
        roomId: '!empty',
        kind: 'person',
        roomType: HYPHA_ROOM_TYPES.dm,
        name: 'Basil Childers',
        otherUserId: '@prod_privy_did_privy_basil:matrix',
        preview: '',
        lastTs: null,
      }),
    ];
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Basil Childers',
          preview: '',
          lastTs: null,
          person: { id: 7, slug: 'basil' },
        },
        { rooms },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!empty',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Basil Childers',
          preview: '',
          lastTs: null,
          person: { id: 7, slug: 'basil' },
        },
        { rememberedRoomId: '!remembered' },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!remembered',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
    expect(
      listedConversationOpenTarget(
        {
          roomId: null,
          name: 'Basil Childers',
          preview: '',
          lastTs: null,
          person: { id: 7, slug: 'basil' },
        },
        { rooms, rememberedRoomId: '!stale' },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!empty',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
    expect(
      listedConversationOpenTarget(
        {
          roomId: '!stale',
          name: 'Basil Childers',
          preview: '',
          lastTs: null,
          person: { id: 7, slug: 'basil' },
        },
        { rooms, rememberedRoomId: '!stale' },
      ),
    ).toEqual({
      kind: 'listed-room',
      roomId: '!empty',
      title: 'Basil Childers',
      peerSlug: 'basil',
    });
    expect(
      listedConversationOpenTarget(
        {
          roomId: '!empty',
          name: 'Basil Childers',
          preview: '',
          lastTs: null,
          person: { id: 7, slug: 'basil' },
        },
        {
          rooms,
          personIdToMatrixUserId: { 7: '@basil-now:matrix' },
        },
      ),
    ).toEqual({ kind: 'ensure-person' });
  });

  it('does not ensure a person room for a preview row', () => {
    expect(
      listedConversationOpenTarget({
        roomId: null,
        name: 'Basil Childers',
        preview: 'Hey @Basil Childers',
        lastTs: 20,
        person: { id: 7, slug: 'basil' },
      }),
    ).toBeNull();
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

describe('previewForInboxDisplay', () => {
  it('keeps a resolved mention line', () => {
    const names = new Map<string, string>([
      [GERARDO.toLowerCase(), 'Gerardo Roza'],
    ]);
    expect(previewForInboxDisplay(`Hey ${GERARDO} ready?`, names)).toBe(
      'Hey @Gerardo Roza ready?',
    );
  });

  it('strips unresolved privy tokens so the row is not stuck loading', () => {
    expect(previewForInboxDisplay(`Hey ${GERARDO} ready for the call?`)).toBe(
      'Hey ready for the call?',
    );
  });
});

describe('senderFirstName', () => {
  it('uses the profile first name and ignores a privy id', () => {
    expect(
      senderFirstName({
        profileName: 'Maria',
        matrixLabel: GERARDO,
        senderUserId: GERARDO,
      }),
    ).toBe('Maria');
  });

  it('takes the first word of a human display name', () => {
    expect(
      senderFirstName({
        memberName: 'Maria Santos',
        senderUserId: '@maria:matrix.example',
      }),
    ).toBe('Maria');
  });

  it('stays blank when the only label is a privy id', () => {
    expect(
      senderFirstName({
        matrixLabel: GERARDO,
        memberName: 'prod_privy_did_privy_cmceozhp9017hjx0mjq0aets5',
        senderUserId: GERARDO,
      }),
    ).toBe('');
  });
});
