import { EventType } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  aggregateCallRaisedHands,
  callReactionsApplyToPinnedSpace,
  CALL_RAISE_HAND_FIELD,
  CALL_RAISE_HAND_NOTICE_TYPE,
  CALL_SESSION_ANCHOR_TYPE,
  filterCallRaisedHandsToInCallParticipants,
  findCallReactionAnchorEventId,
  isCallEphemeralRoomMessageEvent,
  isCallRaiseHandNoticeEvent,
  isCallSessionAnchorEvent,
  parseCallRaiseHandNotice,
  parseCallReactionAnnotation,
} from '../call-reactions';

function mockEvent(input: {
  type: string;
  sender?: string;
  ts?: number;
  eventId?: string;
  content: Record<string, unknown>;
  redacted?: boolean;
}): MatrixEvent {
  return {
    getType: () => input.type,
    getSender: () => input.sender ?? '@alice:example.org',
    getTs: () => input.ts ?? 1000,
    getId: () => input.eventId ?? '$event',
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
    const groupCallId = 'gc-shared';
    const raised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@alice:example.org',
      ts: 100,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
        group_call_id: groupCallId,
      },
    });
    const lowered = mockEvent({
      type: EventType.RoomMessage,
      sender: '@alice:example.org',
      ts: 200,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: false,
        group_call_id: groupCallId,
      },
    });
    const bobRaised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@bob:example.org',
      ts: 150,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
        group_call_id: groupCallId,
      },
    });
    const otherCallRaised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@carol:example.org',
      ts: 160,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
        group_call_id: 'gc-other',
      },
    });

    expect(parseCallRaiseHandNotice(raised)?.raised).toBe(true);
    expect(
      aggregateCallRaisedHands(
        [raised, bobRaised, lowered, otherCallRaised],
        groupCallId,
      ),
    ).toEqual([{ userId: '@bob:example.org', raisedAt: 150 }]);
    expect(aggregateCallRaisedHands([raised, bobRaised], groupCallId)).toEqual([
      { userId: '@alice:example.org', raisedAt: 100 },
      { userId: '@bob:example.org', raisedAt: 150 },
    ]);
    const legacyRaised = mockEvent({
      type: EventType.RoomMessage,
      sender: '@alice:example.org',
      ts: 99,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
      },
    });
    expect(aggregateCallRaisedHands([legacyRaised], groupCallId)).toEqual([]);
    expect(aggregateCallRaisedHands([raised], null)).toEqual([]);
  });

  it('scopes call reactions UI to the pinned call space slug', () => {
    expect(callReactionsApplyToPinnedSpace('space-a', 'space-a')).toBe(true);
    expect(callReactionsApplyToPinnedSpace('space-a', 'space-b')).toBe(false);
    expect(callReactionsApplyToPinnedSpace(null, 'space-b')).toBe(true);
  });

  it('marks session anchor events', () => {
    const anchor = mockEvent({
      type: EventType.RoomMessage,
      content: {
        [CALL_SESSION_ANCHOR_TYPE]: true,
        call_session_id: 'session-1',
      },
    });
    expect(isCallSessionAnchorEvent(anchor)).toBe(true);
    expect(isCallRaiseHandNoticeEvent(anchor)).toBe(false);
    expect(isCallEphemeralRoomMessageEvent(anchor)).toBe(true);
    expect(parseCallRaiseHandNotice(anchor)).toBeNull();
  });

  it('finds the first anchor event id for a group call', () => {
    const first = mockEvent({
      type: EventType.RoomMessage,
      eventId: '$anchor-first',
      content: {
        [CALL_SESSION_ANCHOR_TYPE]: true,
        group_call_id: 'gc-shared',
      },
    });
    const second = mockEvent({
      type: EventType.RoomMessage,
      eventId: '$anchor-second',
      content: {
        [CALL_SESSION_ANCHOR_TYPE]: true,
        group_call_id: 'gc-shared',
      },
    });
    const otherCall = mockEvent({
      type: EventType.RoomMessage,
      eventId: '$anchor-other',
      content: {
        [CALL_SESSION_ANCHOR_TYPE]: true,
        group_call_id: 'gc-other',
      },
    });
    expect(
      findCallReactionAnchorEventId([first, otherCall, second], 'gc-shared'),
    ).toBe('$anchor-first');
    expect(findCallReactionAnchorEventId([otherCall], 'gc-shared')).toBeNull();
  });

  it('filters raised hands to users still in the group call roster', () => {
    const entries = [
      { userId: '@alice:example.org', raisedAt: 100 },
      { userId: '@bob:example.org', raisedAt: 200 },
    ];
    expect(
      filterCallRaisedHandsToInCallParticipants(entries, [
        '@alice:example.org',
      ]),
    ).toEqual([{ userId: '@alice:example.org', raisedAt: 100 }]);
    expect(filterCallRaisedHandsToInCallParticipants(entries, [])).toEqual(
      entries,
    );
    expect(filterCallRaisedHandsToInCallParticipants(entries, null)).toEqual(
      entries,
    );
  });

  it('marks raise-hand notices as ephemeral room messages', () => {
    const raiseHand = mockEvent({
      type: EventType.RoomMessage,
      content: {
        [CALL_RAISE_HAND_NOTICE_TYPE]: true,
        [CALL_RAISE_HAND_FIELD]: true,
      },
    });
    expect(isCallRaiseHandNoticeEvent(raiseHand)).toBe(true);
    expect(isCallEphemeralRoomMessageEvent(raiseHand)).toBe(true);
  });
});
