import { describe, expect, it } from 'vitest';

import {
  conversationActivityTs,
  groupRoomCreatorUserId,
  isAutoJoinGroupInvite,
  isGroupCreateContent,
  isGroupRoomArchivedContent,
  isPeopleGroupRoomType,
  isRoomInDirectAccountData,
  peopleConversationKind,
  peopleConversationKindForListing,
  countCommaSeparatedNames,
  normalizeGroupRoomName,
  readRoomNameState,
  sortConversationsByLastMessage,
} from '../group-room';
import { HYPHA_ROOM_TYPES } from '../room-types';

const bot = '@hypha-bot:hypha.earth';

describe('group room invite', () => {
  it('joins a bot-created group the member was only invited to', () => {
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(true);
  });

  it('leaves space rooms, direct rooms, and outside invites alone', () => {
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: '#space:hypha.earth',
        roomName: 'Water, Food',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'join',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: '@someone:hypha.earth',
        botUserId: bot,
      }),
    ).toBe(false);
  });
});

describe('group room name and archive state', () => {
  it('trims and caps a group title', () => {
    expect(normalizeGroupRoomName('  Water  team  ')).toBe('Water team');
    expect(normalizeGroupRoomName('x'.repeat(200))).toHaveLength(120);
    expect(normalizeGroupRoomName(`${'x'.repeat(119)}😀y`)).toBe(
      `${'x'.repeat(119)}😀`,
    );
  });

  it('treats untyped rooms as groups only when more than two people joined', () => {
    expect(isPeopleGroupRoomType(HYPHA_ROOM_TYPES.group, 2)).toBe(true);
    expect(isPeopleGroupRoomType(null, 3)).toBe(true);
    expect(isPeopleGroupRoomType('', 4)).toBe(true);
    expect(isPeopleGroupRoomType(null, 2)).toBe(false);
    expect(isPeopleGroupRoomType(HYPHA_ROOM_TYPES.dm, 3)).toBe(false);
  });

  it('keeps a two-person room as a group only when it is group-typed', () => {
    expect(isPeopleGroupRoomType(null, 2, { createdAsGroup: true })).toBe(true);
    expect(isPeopleGroupRoomType(null, 2)).toBe(false);
    expect(isPeopleGroupRoomType(HYPHA_ROOM_TYPES.dm, 2)).toBe(false);
  });

  it('lists a group-typed room even before other members load', () => {
    expect(peopleConversationKind(HYPHA_ROOM_TYPES.group, 1)).toBe('group');
    expect(peopleConversationKind(HYPHA_ROOM_TYPES.group, 0)).toBe('group');
    expect(peopleConversationKind(null, 2)).toBeNull();
    expect(peopleConversationKind(HYPHA_ROOM_TYPES.dm, 2)).toBe('person');
  });

  it('keeps a renamed untyped 3-person group after reload with lazy members', () => {
    // Gerardo Roza, Xerxes Potel, Vlad Hramtsov → "... (test)".
    // Rename writes m.room.name only. After a hard reload Matrix often
    // exposes only the current user until members lazy-load.
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 1,
        summaryJoinedCount: 4,
        hasRoomName: true,
      }),
    ).toBe('group');
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 1,
        summaryJoinedCount: 1,
        hasRoomName: true,
      }),
    ).toBe('group');
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 3,
        summaryJoinedCount: 4,
        hasRoomName: true,
      }),
    ).toBe('group');
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 2,
        summaryJoinedCount: 2,
        hasRoomName: true,
      }),
    ).toBeNull();
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 2,
        summaryJoinedCount: 2,
        hasRoomName: true,
        titleMemberHint: countCommaSeparatedNames(
          'Gerardo Roza, Xerxes Potel, Vlad Hramtsov (test)',
        ),
      }),
    ).toBe('group');
    expect(
      peopleConversationKindForListing({
        roomType: null,
        loadedHumanCount: 2,
        summaryJoinedCount: 2,
        hasRoomName: true,
        rememberedHumanCount: 3,
      }),
    ).toBe('group');
  });

  it('reads a room name state event and m.direct membership', () => {
    expect(
      readRoomNameState({
        currentState: {
          getStateEvents: (type) =>
            type === 'm.room.name'
              ? {
                  getContent: () => ({
                    name: 'Vlad Hramtsov, Kate Bennett (test)',
                  }),
                }
              : null,
        },
      }),
    ).toBe('Vlad Hramtsov, Kate Bennett (test)');
    expect(
      readRoomNameState({
        currentState: {
          getStateEvents: (type, key) =>
            type === 'm.room.name' && key === ''
              ? {
                  getContent: () => ({
                    name: '  Water team  ',
                  }),
                }
              : null,
        },
      }),
    ).toBe('Water team');
    expect(
      readRoomNameState({
        currentState: {
          getStateEvents: (type, key) => {
            if (type !== 'm.room.name') return key === undefined ? [] : null;
            if (key === '') return null;
            return [
              {
                getContent: () => ({
                  name: 'Vlad Hramtsov, Kate Bennett (test)',
                }),
              },
            ];
          },
        },
      }),
    ).toBe('Vlad Hramtsov, Kate Bennett (test)');
    expect(
      readRoomNameState({ currentState: { getStateEvents: () => null } }),
    ).toBeNull();
    expect(isGroupCreateContent({ type: HYPHA_ROOM_TYPES.group })).toBe(true);
    expect(isGroupCreateContent({ type: HYPHA_ROOM_TYPES.dm })).toBe(false);
    expect(
      isRoomInDirectAccountData(
        { '@kate:hypha': ['!dm'], '@other:hypha': ['!other'] },
        '!dm',
      ),
    ).toBe(true);
    expect(
      isRoomInDirectAccountData({ '@kate:hypha': ['!dm'] }, '!group'),
    ).toBe(false);
  });

  it('reads archived and creator state', () => {
    expect(isGroupRoomArchivedContent({ archived: true })).toBe(true);
    expect(isGroupRoomArchivedContent({ archived: false })).toBe(false);
    expect(groupRoomCreatorUserId({ userId: '@ada:hypha' })).toBe('@ada:hypha');
    expect(groupRoomCreatorUserId({})).toBeNull();
  });
});

describe('sortConversationsByLastMessage', () => {
  it('orders by last message recency, newest first', () => {
    const ranked = sortConversationsByLastMessage([
      { name: 'Older unread', lastTs: 100, roomId: '!old', unread: 4 },
      { name: 'Marieke', lastTs: 500, roomId: '!marie', unread: 0 },
      { name: 'No messages yet', lastTs: null, roomId: '!empty' },
      { name: 'Yesterday', lastTs: 200, roomId: '!yest' },
    ]);
    expect(ranked.map((row) => row.name)).toEqual([
      'Marieke',
      'Yesterday',
      'Older unread',
      'No messages yet',
    ]);
  });

  it('keeps equal timestamps stable by name then room id', () => {
    const ranked = sortConversationsByLastMessage([
      { name: 'Zed', lastTs: 10, roomId: '!b' },
      { name: 'Ann', lastTs: 10, roomId: '!c' },
      { name: 'Ann', lastTs: 10, roomId: '!a' },
    ]);
    expect(ranked.map((row) => row.roomId)).toEqual(['!a', '!c', '!b']);
  });

  it('uses the last message only and ignores room activity', () => {
    expect(conversationActivityTs(null, 900)).toBeNull();
    expect(conversationActivityTs(400, 900)).toBe(400);
    expect(conversationActivityTs(400, 0)).toBe(400);
    expect(conversationActivityTs(null, null)).toBeNull();
  });
});
