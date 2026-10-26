import { describe, expect, it } from 'vitest';

import { findJoinedDirectRoomId, waitUntil } from '../open-direct-room';
import { HYPHA_ROOM_TYPES } from '../room-types';

describe('findJoinedDirectRoomId', () => {
  it('returns the joined typed DM for that person', () => {
    expect(
      findJoinedDirectRoomId(
        [
          {
            roomId: '!group',
            membership: 'join',
            type: HYPHA_ROOM_TYPES.group,
            otherUserIds: ['@alex:hypha'],
          },
          {
            roomId: '!dm',
            membership: 'join',
            type: HYPHA_ROOM_TYPES.dm,
            otherUserIds: ['@alex:hypha'],
          },
        ],
        '@alex:hypha',
      ),
    ).toBe('!dm');
  });

  it('ignores untyped rooms and people who have not joined', () => {
    expect(
      findJoinedDirectRoomId(
        [
          {
            roomId: '!old',
            membership: 'join',
            type: null,
            otherUserIds: ['@alex:hypha'],
          },
          {
            roomId: '!left',
            membership: 'leave',
            type: HYPHA_ROOM_TYPES.dm,
            otherUserIds: ['@alex:hypha'],
          },
        ],
        '@alex:hypha',
      ),
    ).toBeNull();
  });
});

describe('waitUntil', () => {
  it('returns once the predicate is true', async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 20);
    await expect(waitUntil(() => ready, 10, 10)).resolves.toBe(true);
  });
});
