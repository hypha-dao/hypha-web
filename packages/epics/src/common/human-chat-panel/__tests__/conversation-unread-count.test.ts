import {
  EventStatus,
  EventType,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';

import { countIncomingUnreadMessages } from '../conversation-unread-count';

const SELF = '@me:example.org';
const OTHER = '@ada:example.org';

function message(input: {
  id: string;
  sender?: string;
  ts: number;
  body?: string;
  msgtype?: string;
  status?: EventStatus;
  content?: Record<string, unknown>;
}): MatrixEvent {
  const content = {
    msgtype: input.msgtype ?? 'm.text',
    body: input.body ?? 'hello',
    ...input.content,
  };
  return {
    getType: () => EventType.RoomMessage,
    getSender: () => input.sender,
    getTs: () => input.ts,
    getId: () => input.id,
    isRedacted: () => false,
    getContent: () => content,
    status: input.status ?? null,
    sender: input.sender ? { userId: input.sender, name: input.sender } : null,
  } as MatrixEvent;
}

function roomFor(
  events: MatrixEvent[],
  options?: {
    pending?: MatrixEvent[];
    readUpTo?: string | null;
    receiptTs?: number;
    readEventIds?: string[];
  },
): Room {
  const pending = options?.pending ?? [];
  const readUpTo = options?.readUpTo ?? null;
  return {
    getLiveTimeline: () => ({ getEvents: () => events }),
    getPendingEvents: () => pending,
    getEventReadUpTo: () => readUpTo,
    findEventById: (id: string) =>
      [...events, ...pending].find((event) => event.getId() === id) ?? null,
    compareEventOrdering: (left: string, right: string) => {
      const timeline = [...events, ...pending];
      const leftIndex = timeline.findIndex((event) => event.getId() === left);
      const rightIndex = timeline.findIndex((event) => event.getId() === right);
      if (leftIndex < 0 || rightIndex < 0) return null;
      return Math.sign(leftIndex - rightIndex);
    },
    hasUserReadEvent: (_userId: string, eventId: string) =>
      options?.readEventIds?.includes(eventId) ?? false,
    getLastUnthreadedReceiptFor: () =>
      options?.receiptTs != null ? { ts: options.receiptTs } : undefined,
  } as unknown as Room;
}

const ignoreNobody = () => false;

describe('countIncomingUnreadMessages', () => {
  it('stays at zero when the member sent the latest message', () => {
    const count = countIncomingUnreadMessages(
      roomFor([
        message({ id: '$in', sender: OTHER, ts: 1_000, body: 'ping' }),
        message({ id: '$out', sender: SELF, ts: 2_000, body: 'pong' }),
      ]),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(0);
  });

  it('does not count an older message when ordering against the receipt is unknown', () => {
    const count = countIncomingUnreadMessages(
      roomFor(
        [message({ id: '$in', sender: OTHER, ts: 1_000, body: 'ping' })],
        {
          pending: [
            message({
              id: '$out',
              sender: SELF,
              ts: 2_000,
              body: 'pong',
              status: EventStatus.SENDING,
            }),
          ],
          readUpTo: '$missing-receipt',
        },
      ),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(0);
  });

  it('counts a message that arrived after the member last wrote', () => {
    const count = countIncomingUnreadMessages(
      roomFor([
        message({ id: '$out', sender: SELF, ts: 1_000, body: 'hello' }),
        message({ id: '$in', sender: OTHER, ts: 2_000, body: 'hi' }),
      ]),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(1);
  });

  it('counts an unread message when the member has never written or read', () => {
    const count = countIncomingUnreadMessages(
      roomFor([message({ id: '$in', sender: OTHER, ts: 1_000, body: 'hi' })]),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(1);
  });

  it('ignores notices and call markers', () => {
    const count = countIncomingUnreadMessages(
      roomFor([
        message({
          id: '$notice',
          sender: OTHER,
          ts: 1_000,
          msgtype: 'm.notice',
          body: 'call started',
        }),
        message({
          id: '$call',
          sender: OTHER,
          ts: 2_000,
          content: { 'io.hypha.call.session_anchor.v1': true },
        }),
      ]),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(0);
  });

  it('ignores a message the member has already read', () => {
    const count = countIncomingUnreadMessages(
      roomFor([message({ id: '$in', sender: OTHER, ts: 5_000, body: 'hi' })], {
        receiptTs: 5_000,
      }),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(0);
  });

  it('does not let a failed send hide an incoming message', () => {
    const count = countIncomingUnreadMessages(
      roomFor([
        message({ id: '$in', sender: OTHER, ts: 2_000, body: 'hi' }),
        message({
          id: '$out',
          sender: SELF,
          ts: 3_000,
          body: 'nope',
          status: EventStatus.NOT_SENT,
        }),
      ]),
      SELF,
      ignoreNobody,
    );
    expect(count).toBe(1);
  });

  it('still counts when pending events cannot be listed', () => {
    const room = roomFor([
      message({ id: '$in', sender: OTHER, ts: 1_000, body: 'hi' }),
    ]);
    room.getPendingEvents = () => {
      throw new Error(
        'Cannot call getPendingEvents with pendingEventOrdering == chronological',
      );
    };
    expect(countIncomingUnreadMessages(room, SELF, ignoreNobody)).toBe(1);
  });
});
