import { EventType } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  aggregateCallRaisedHands,
  CALL_RAISE_HAND_FIELD,
  CALL_RAISE_HAND_NOTICE_TYPE,
  CALL_SESSION_ANCHOR_TYPE,
  parseCallRaiseHandNotice,
  parseCallReactionAnnotation,
} from '../call-reactions';

function mockEvent(input: {
  type: string;
  sender?: string;
  ts?: number;
  content: Record<string, unknown>;
  redacted?: boolean;
}): MatrixEvent {
  return {
    getType: () => input.type,
    getSender: () => input.sender ?? '@alice:example.org',
    getTs: () => input.ts ?? 1000,
    isRedacted: () => input.redacted ?? false,
    getContent: () => input.content,
    getWireContent: () => input.content,
  } as MatrixEvent;
}

describe('call-reactions (WCUX-REACT)', () => {
  it('parses reaction annotations targeting the session anchor', () => {
    const event = mockEvent({
      type: EventType.Reaction,
      sender: '@bob:example.org',
      content: {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: '$anchor',
          key: '👍',
        },
      },
    });
    expect(parseCallReactionAnnotation(event, '$anchor')).toEqual({
      userId: '@bob:example.org',
      key: '👍',
    });
    expect(parseCallReactionAnnotation(event, '$other')).toBeNull();
  });

  it('aggregates raise-hand notices with last event per user winning', () => {
    const raised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@alice:example.org',
      ts: 100,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
      },
    });
    const lowered = mockEvent({
      type: EventType.RoomMessage,
      sender: '@alice:example.org',
      ts: 200,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: false,
      },
    });
    const bobRaised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@bob:example.org',
      ts: 150,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
      },
    });

    expect(parseCallRaiseHandNotice(raised)?.raised).toBe(true);
    expect(aggregateCallRaisedHands([raised, bobRaised, lowered])).toEqual([
      { userId: '@bob:example.org', raisedAt: 150 },
    ]);
  });

  it('marks session anchor events', () => {
    const anchor = mockEvent({
      type: EventType.RoomMessage,
      content: {
        [CALL_SESSION_ANCHOR_TYPE]: true,
        call_session_id: 'session-1',
      },
    });
    expect(parseCallRaiseHandNotice(anchor)).toBeNull();
  });
});
