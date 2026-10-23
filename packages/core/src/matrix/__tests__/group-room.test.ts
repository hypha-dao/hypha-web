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
    expect(isPeopleGroupRoomType(null, 2, { hasCreator: true })).toBe(true);
    expect(isPeopleGroupRoomType(null, 2, { remembered: true })).toBe(true);
    expect(
      isPeopleGroupRoomType(HYPHA_ROOM_TYPES.dm, 2, { hasCreator: true }),
    ).toBe(false);
  });

  it('keeps a named two-person non-DM room as a group', () => {
    expect(isPeopleGroupRoomType(null, 2, { hasRoomName: true })).toBe(true);
    expect(isPeopleGroupRoomType(null, 2, { createdAsGroup: true })).toBe(true);
    expect(
      isPeopleGroupRoomType(HYPHA_ROOM_TYPES.dm, 2, { hasRoomName: true }),
    ).toBe(false);
  });

  it('lists the renamed Vlad+Kate legacy group even when it is in m.direct', () => {
    // Exact preview room: untyped, 2 humans, custom m.room.name, no creator
    // state, not remembered. Matrix also filed it under Kate in m.direct.
    // add60a5 treated inDirect first, so kind became person and the untyped
    // person row was dropped — Kate stayed as a directory person only.
    const flags = {
      hasCreator: false,
      remembered: false,
      hasRoomName: true,
      inDirect: true,
      createdAsGroup: false,
    };
    expect(isPeopleGroupRoomType(null, 2, flags)).toBe(true);
    expect(peopleConversationKind(null, 2, flags)).toBe('group');
    expect(
      peopleConversationKind(null, 2, { inDirect: true, hasRoomName: false }),
    ).toBeNull();
    expect(
      peopleConversationKind(HYPHA_ROOM_TYPES.dm, 2, {
        hasRoomName: true,
        inDirect: true,
      }),
    ).toBe('person');
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
