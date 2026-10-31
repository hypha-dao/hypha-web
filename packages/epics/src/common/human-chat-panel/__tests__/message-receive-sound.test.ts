import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventType, type MatrixEvent, type Room } from 'matrix-js-sdk';

import {
  isIncomingConversationMessage,
  isMessageAlreadyReadBySelf,
  isMessageRecentEnoughForReceiveSound,
  playMessageReceiveSoundForEvent,
  RECENT_MESSAGE_MS,
  resetMessageReceiveSoundCooldownForTests,
} from '../message-receive-sound';

function fakeEvent(overrides: {
  type?: string;
  sender?: string;
  body?: string;
  id?: string;
  ts?: number;
  redacted?: boolean;
  replace?: boolean;
  notice?: boolean;
}): MatrixEvent {
  const content: Record<string, unknown> = {
    body: overrides.body ?? 'hello',
    msgtype: overrides.notice ? 'm.notice' : 'm.text',
  };
  if (overrides.replace) {
    content['m.relates_to'] = { rel_type: 'm.replace' };
  }
  return {
    getType: () => overrides.type ?? EventType.RoomMessage,
    getSender: () => overrides.sender ?? '@alice:hs',
    sender: { userId: overrides.sender ?? '@alice:hs' },
    getContent: () => content,
    getId: () => overrides.id ?? 'evt-1',
    getTs: () => overrides.ts ?? Date.now(),
    isRedacted: () => Boolean(overrides.redacted),
  } as unknown as MatrixEvent;
}

function fakeRoom(overrides: {
  readId?: string | null;
  readTs?: number;
  receiptTs?: number;
}): Room {
  return {
    getEventReadUpTo: () => overrides.readId ?? null,
    findEventById: (id: string) =>
      id && overrides.readId === id
        ? fakeEvent({ id, ts: overrides.readTs ?? 0 })
        : undefined,
    getLastUnthreadedReceiptFor: () =>
      typeof overrides.receiptTs === 'number'
        ? { ts: overrides.receiptTs }
        : undefined,
  } as unknown as Room;
}

describe('isIncomingConversationMessage', () => {
  it('accepts a normal message from someone else', () => {
    expect(isIncomingConversationMessage(fakeEvent({}), '@me:hs')).toBe(true);
  });

  it('rejects own messages, edits, notices, and redactions', () => {
    expect(
      isIncomingConversationMessage(fakeEvent({ sender: '@me:hs' }), '@me:hs'),
    ).toBe(false);
    expect(
      isIncomingConversationMessage(fakeEvent({ replace: true }), '@me:hs'),
    ).toBe(false);
    expect(
      isIncomingConversationMessage(fakeEvent({ notice: true }), '@me:hs'),
    ).toBe(false);
    expect(
      isIncomingConversationMessage(fakeEvent({ redacted: true }), '@me:hs'),
    ).toBe(false);
  });
});

describe('isMessageRecentEnoughForReceiveSound', () => {
  it('rejects wake / catch-up events older than the recent window', () => {
    const now = Date.now();
    expect(
      isMessageRecentEnoughForReceiveSound(
        fakeEvent({ ts: now - RECENT_MESSAGE_MS - 1 }),
        now,
      ),
    ).toBe(false);
    expect(
      isMessageRecentEnoughForReceiveSound(fakeEvent({ ts: now - 1_000 }), now),
    ).toBe(true);
  });
});

describe('isMessageAlreadyReadBySelf', () => {
  it('is true when the read receipt is at or past the event', () => {
    const event = fakeEvent({ id: 'evt-2', ts: 2_000 });
    expect(
      isMessageAlreadyReadBySelf(
        fakeRoom({ readId: 'evt-2', readTs: 2_000 }),
        event,
        '@me:hs',
      ),
    ).toBe(true);
    expect(
      isMessageAlreadyReadBySelf(
        fakeRoom({ readId: 'evt-9', readTs: 9_000 }),
        event,
        '@me:hs',
      ),
    ).toBe(true);
    expect(
      isMessageAlreadyReadBySelf(
        fakeRoom({ readId: 'evt-1', readTs: 1_000 }),
        event,
        '@me:hs',
      ),
    ).toBe(false);
  });
});

describe('playMessageReceiveSoundForEvent', () => {
  afterEach(() => {
    resetMessageReceiveSoundCooldownForTests();
    vi.unstubAllGlobals();
  });

  it('does not throw when skipping history / catch-up', () => {
    expect(() =>
      playMessageReceiveSoundForEvent(fakeEvent({}), '@me:hs', {
        toStartOfTimeline: true,
      }),
    ).not.toThrow();
    expect(() =>
      playMessageReceiveSoundForEvent(fakeEvent({}), '@me:hs', {
        liveEvent: false,
      }),
    ).not.toThrow();
  });

  it('stays silent when the document is hidden', () => {
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
    });
    expect(() =>
      playMessageReceiveSoundForEvent(fakeEvent({}), '@me:hs'),
    ).not.toThrow();
  });

  it('stays silent when another device already read the event', () => {
    vi.stubGlobal('document', {
      visibilityState: 'visible',
    });
    const event = fakeEvent({ id: 'evt-2', ts: Date.now() });
    expect(() =>
      playMessageReceiveSoundForEvent(event, '@me:hs', {
        room: fakeRoom({ readId: 'evt-2', readTs: event.getTs() }),
      }),
    ).not.toThrow();
  });
});
