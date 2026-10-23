import { describe, expect, it, vi } from 'vitest';

import { coherences, spaces } from '@hypha-platform/storage-postgres';

import {
  findBoundChatRoomIdsAmong,
  isRoomBoundToSpaceOrSignal,
} from '../queries';

type BoundRow = { id?: number; roomId?: string | null };

function mockBindingDb(options: {
  space?: BoundRow[];
  signal?: BoundRow[];
  onSignalWhere?: (condition: unknown) => void;
}) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          if (table === coherences) options.onSignalWhere?.(condition);
          const rows =
            table === spaces ? options.space ?? [] : options.signal ?? [];
          return {
            limit: async () => rows,
            then: (
              resolve: (value: BoundRow[]) => BoundRow[],
              reject?: (reason: unknown) => BoundRow[],
            ) => Promise.resolve(rows).then(resolve, reject),
          };
        },
      }),
    }),
  };
}

describe('isRoomBoundToSpaceOrSignal', () => {
  it('treats an archived coherence as bound', async () => {
    const onSignalWhere = vi.fn();
    const db = mockBindingDb({
      space: [],
      signal: [{ id: 9 }],
      onSignalWhere,
    });
    await expect(
      isRoomBoundToSpaceOrSignal(
        { roomId: '!old-signal' },
        { db: db as never },
      ),
    ).resolves.toBe(true);
    expect(onSignalWhere).toHaveBeenCalledTimes(1);
  });

  it('treats a space chat room as bound', async () => {
    const db = mockBindingDb({ space: [{ id: 3 }], signal: [] });
    await expect(
      isRoomBoundToSpaceOrSignal({ roomId: '!space' }, { db: db as never }),
    ).resolves.toBe(true);
  });
});

describe('findBoundChatRoomIdsAmong', () => {
  it('returns archived signal rooms alongside space chats', async () => {
    const db = mockBindingDb({
      space: [{ roomId: '!space' }],
      signal: [{ roomId: '!archived-signal' }],
    });
    await expect(
      findBoundChatRoomIdsAmong(
        { roomIds: ['!space', '!archived-signal', '!group'] },
        { db: db as never },
      ),
    ).resolves.toEqual(['!space', '!archived-signal']);
  });
});
