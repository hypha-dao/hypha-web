import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearInboxListSnapshot,
  keepPaintedInboxRows,
  readInboxListSnapshot,
  writeInboxListSnapshot,
} from '../messages-inbox-snapshot';
import type { ConversationRow } from '../member-connections';

const row: ConversationRow = {
  roomId: '!dm:example',
  name: 'Alex',
  preview: 'Hello',
  mine: false,
  lastTs: 10,
  unread: 1,
  memberCount: 2,
  otherUserId: '@alex:example',
  kind: 'person',
};

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  const session = memoryStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { sessionStorage: session });
});

afterEach(() => {
  clearInboxListSnapshot();
  vi.unstubAllGlobals();
});

describe('messages inbox snapshot', () => {
  it('round-trips the last painted list', () => {
    writeInboxListSnapshot({
      rows: [row],
      channels: [
        {
          roomId: '!space:example',
          roomType: 'io.hypha.room.space',
          name: 'Hypha',
          aliases: [],
          preview: 'Update',
          mine: false,
          lastTs: 20,
          unread: 0,
        },
      ],
    });
    expect(readInboxListSnapshot().rows[0]?.name).toBe('Alex');
    expect(readInboxListSnapshot().channels[0]?.name).toBe('Hypha');
  });

  it('keeps the painted list while live sync is still empty', () => {
    expect(keepPaintedInboxRows([row], [], false)).toEqual([row]);
    expect(keepPaintedInboxRows([row], [], true)).toEqual([]);
  });

  it('prefers live rows once any have arrived', () => {
    const live = { ...row, preview: 'Newer' };
    expect(keepPaintedInboxRows([row], [live], false)).toEqual([live]);
  });
});
