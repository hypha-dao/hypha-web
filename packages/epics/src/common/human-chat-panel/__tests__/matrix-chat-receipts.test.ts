import { describe, expect, it } from 'vitest';

import {
  dmPeerMatrixUserId,
  messageIsReadByPeer,
  ownMessageReceiptStatus,
  peerReadUpToEventId,
} from '../matrix-chat-receipts';

function roomStub(input: {
  members?: Array<{
    userId?: string;
    membership?: string;
    name?: string;
    rawDisplayName?: string;
  }>;
  readUpTo?: Record<string, string | null>;
  /** When set, preferred over getEventReadUpTo (public m.read only). */
  publicReadUpTo?: Record<string, string | null>;
  ordering?: Record<string, number>;
}) {
  return {
    getMembers: () => input.members ?? [],
    getEventReadUpTo: (userId: string) => input.readUpTo?.[userId] ?? null,
    getReadReceiptForUserId: (
      userId: string,
      _ignoreSynthesized?: boolean,
      _receiptType?: string,
    ) => {
      const eventId =
        input.publicReadUpTo?.[userId] ?? input.readUpTo?.[userId];
      return eventId ? { eventId } : null;
    },
    hasUserReadEvent: (userId: string, eventId: string) => {
      const cursor = input.readUpTo?.[userId];
      if (!cursor) return false;
      if (cursor === eventId) return true;
      const rank = input.ordering ?? {};
      const cursorRank = rank[cursor];
      const eventRank = rank[eventId];
      if (cursorRank == null || eventRank == null) return false;
      return cursorRank >= eventRank;
    },
    compareEventOrdering: (left: string, right: string) => {
      const rank = input.ordering ?? {};
      if (rank[left] == null || rank[right] == null) return null;
      return rank[left]! - rank[right]!;
    },
  };
}

describe('dmPeerMatrixUserId', () => {
  it('returns the single other joined member', () => {
    const room = roomStub({
      members: [
        { userId: '@me:hypha', membership: 'join' },
        { userId: '@peer:hypha', membership: 'join' },
      ],
    });
    expect(dmPeerMatrixUserId(room, '@me:hypha')).toBe('@peer:hypha');
  });

  it('returns null for group rooms', () => {
    const room = roomStub({
      members: [
        { userId: '@me:hypha', membership: 'join' },
        { userId: '@a:hypha', membership: 'join' },
        { userId: '@b:hypha', membership: 'join' },
      ],
    });
    expect(dmPeerMatrixUserId(room, '@me:hypha')).toBeNull();
  });

  it('ignores Hypha bots when finding the single peer', () => {
    const room = roomStub({
      members: [
        { userId: '@me:matrix.hypha.earth', membership: 'join' },
        { userId: '@peer:matrix.hypha.earth', membership: 'join' },
        {
          userId: '@hypha_bot:matrix.hypha.earth',
          membership: 'join',
          name: 'hypha_bot',
        },
      ],
    });
    expect(dmPeerMatrixUserId(room, '@me:matrix.hypha.earth')).toBe(
      '@peer:matrix.hypha.earth',
    );
  });
});

describe('messageIsReadByPeer', () => {
  const room = roomStub({
    readUpTo: { '@peer:hypha': 'evt-2' },
    ordering: { 'evt-1': 1, 'evt-2': 2, 'evt-3': 3 },
  });

  it('is true for the cursor event and earlier events', () => {
    expect(messageIsReadByPeer(room, '@peer:hypha', 'evt-2')).toBe(true);
    expect(messageIsReadByPeer(room, '@peer:hypha', 'evt-1')).toBe(true);
  });

  it('is false for events after the cursor', () => {
    expect(messageIsReadByPeer(room, '@peer:hypha', 'evt-3')).toBe(false);
  });

  it('is false without a peer receipt', () => {
    expect(peerReadUpToEventId(room, '@other:hypha')).toBeNull();
    expect(messageIsReadByPeer(room, '@other:hypha', 'evt-1')).toBe(false);
  });
});

describe('ownMessageReceiptStatus', () => {
  const room = roomStub({
    readUpTo: { '@peer:hypha': 'evt-1' },
    ordering: { 'evt-1': 1, 'evt-2': 2 },
  });

  it('stays pending while sending', () => {
    expect(
      ownMessageReceiptStatus({
        sendPending: true,
        eventId: 'evt-1',
        peerId: '@peer:hypha',
        room,
      }),
    ).toBe('pending');
  });

  it('marks read when the peer receipt covers the event', () => {
    expect(
      ownMessageReceiptStatus({
        eventId: 'evt-1',
        peerId: '@peer:hypha',
        room,
      }),
    ).toBe('read');
  });

  it('marks sent when the peer has not read yet', () => {
    expect(
      ownMessageReceiptStatus({
        eventId: 'evt-2',
        peerId: '@peer:hypha',
        room,
      }),
    ).toBe('sent');
  });

  it('stays pending until the Matrix echo is acknowledged', () => {
    expect(
      ownMessageReceiptStatus({
        sendAcknowledged: false,
        eventId: 'evt-2',
        peerId: '@peer:hypha',
        room,
      }),
    ).toBe('pending');
  });
});

describe('peer public m.read only', () => {
  it('ignores a synthesized later cursor that is not public m.read', () => {
    const room = roomStub({
      readUpTo: { '@peer:hypha': 'evt-2' },
      publicReadUpTo: { '@peer:hypha': 'evt-1' },
      ordering: { 'evt-1': 1, 'evt-2': 2 },
    });
    expect(peerReadUpToEventId(room, '@peer:hypha')).toBe('evt-1');
    expect(messageIsReadByPeer(room, '@peer:hypha', 'evt-2')).toBe(false);
    expect(messageIsReadByPeer(room, '@peer:hypha', 'evt-1')).toBe(true);
  });
});
