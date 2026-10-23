import { describe, expect, it, vi } from 'vitest';

import { HYPHA_ROOM_TYPES } from '../../../../../core/src/matrix/room-types';
import { rememberGroupChatRooms } from '../../../people/components/member-connections';

import { openDialogAfterMenu } from '../open-dialog-after-menu';
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

  it('does not treat a remembered or named untyped pair as a group', () => {
    rememberGroupChatRooms(['!remembered-pair']);
    expect(
      isPeopleGroupChatRoom({
        roomId: '!remembered-pair',
        getType: () => undefined,
        getJoinedMemberCount: () => 2,
      }),
    ).toBe(false);
    expect(
      isPeopleGroupChatRoom({
        roomId: '!legacy',
        getType: () => undefined,
        getJoinedMemberCount: () => 2,
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
    ).toBe(false);
  });

  it('keeps a two-person room when create content is group-typed', () => {
    expect(
      isPeopleGroupChatRoom({
        roomId: '!dm',
        getType: () => HYPHA_ROOM_TYPES.dm,
        getJoinedMemberCount: () => 2,
      }),
    ).toBe(false);
    expect(
      isPeopleGroupChatRoom({
        roomId: '!typed',
        getType: () => undefined,
        getJoinedMemberCount: () => 2,
        currentState: {
          getStateEvents: (type) =>
            type === 'm.room.create'
              ? { getContent: () => ({ type: HYPHA_ROOM_TYPES.group }) }
              : null,
        },
      }),
    ).toBe(true);
  });
});

describe('openDialogAfterMenu', () => {
  it('opens on the next frames so the menu can release pointer events', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const open = vi.fn();
    openDialogAfterMenu(open);
    expect(open).not.toHaveBeenCalled();
    frames[0]?.(0);
    expect(open).not.toHaveBeenCalled();
    frames[1]?.(0);
    expect(open).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
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
