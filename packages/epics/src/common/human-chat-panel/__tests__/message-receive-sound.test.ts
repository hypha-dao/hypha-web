import { describe, expect, it } from 'vitest';
import { EventType, type MatrixEvent } from 'matrix-js-sdk';

import {
  isIncomingConversationMessage,
  playMessageReceiveSoundForEvent,
} from '../message-receive-sound';

function fakeEvent(overrides: {
  type?: string;
  sender?: string;
  body?: string;
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
    getId: () => 'evt-1',
    getTs: () => overrides.ts ?? Date.now(),
    isRedacted: () => Boolean(overrides.redacted),
  } as unknown as MatrixEvent;
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

describe('playMessageReceiveSoundForEvent', () => {
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
});
