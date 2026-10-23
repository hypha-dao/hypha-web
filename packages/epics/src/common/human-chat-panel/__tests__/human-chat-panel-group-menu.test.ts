import { describe, expect, it } from 'vitest';

import { HYPHA_ROOM_TYPES } from '../../../../../core/src/matrix/room-types';

import {
  canArchivePeopleGroupRoom,
  isPeopleGroupChatRoom,
} from '../people-group-room';

describe('isPeopleGroupChatRoom', () => {
  it('accepts an explicit group room type', () => {
    expect(
      isPeopleGroupChatRoom({
        getType: () => HYPHA_ROOM_TYPES.group,
        getJoinedMemberCount: () => 2,
      }),
    ).toBe(true);
  });

  it('accepts an untyped room with more than two people', () => {
    expect(
      isPeopleGroupChatRoom({
        getType: () => undefined,
        getJoinedMemberCount: () => 3,
      }),
    ).toBe(true);
    expect(
      isPeopleGroupChatRoom({
        getType: () => HYPHA_ROOM_TYPES.dm,
        getJoinedMemberCount: () => 2,
      }),
    ).toBe(false);
    expect(
      isPeopleGroupChatRoom({
        getType: () => undefined,
        getJoinedMemberCount: () => 2,
      }),
    ).toBe(false);
  });
});

describe('canArchivePeopleGroupRoom', () => {
  it('lets the stored creator archive', () => {
    expect(
      canArchivePeopleGroupRoom(
        {
          roomId: '!g',
          currentState: {
            getStateEvents: (type) =>
              type === 'io.hypha.room.group_creator'
                ? { getContent: () => ({ userId: '@ada:hypha' }) }
                : null,
          },
        },
        '@ada:hypha',
      ),
    ).toBe(true);
    expect(
      canArchivePeopleGroupRoom(
        {
          roomId: '!g',
          currentState: {
            getStateEvents: (type) =>
              type === 'io.hypha.room.group_creator'
                ? { getContent: () => ({ userId: '@ada:hypha' }) }
                : null,
          },
        },
        '@other:hypha',
      ),
    ).toBe(false);
  });

  it('lets power level 100 archive when another member is the stored creator', () => {
    expect(
      canArchivePeopleGroupRoom(
        {
          roomId: '!g',
          currentState: {
            getStateEvents: (type) =>
              type === 'io.hypha.room.group_creator'
                ? { getContent: () => ({ userId: '@ada:hypha' }) }
                : null,
          },
          getMember: (userId) =>
            userId === '@admin:hypha' ? { powerLevel: 100 } : { powerLevel: 0 },
        },
        '@admin:hypha',
      ),
    ).toBe(true);
  });

  it('lets any member archive a legacy group without a stored creator', () => {
    expect(
      canArchivePeopleGroupRoom(
        {
          roomId: '!legacy',
          currentState: { getStateEvents: () => null },
        },
        '@member:hypha',
      ),
    ).toBe(true);
  });
});
