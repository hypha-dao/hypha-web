'use client';

import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { isValidReactionKey } from '../../reactions';
import {
  CALL_RAISE_HAND_FIELD,
  CALL_RAISE_HAND_NOTICE_TYPE,
  CALL_SESSION_ANCHOR_TYPE,
  findCallReactionAnchorEventId,
} from './call-reactions';

export async function publishCallSessionAnchor(options: {
  client: MatrixClient;
  roomId: string;
  groupCallId: string;
}): Promise<string | null> {
  const { client, roomId, groupCallId } = options;
  const stableGroupCallId = groupCallId.trim();
  const content = {
    msgtype: MsgType.Notice,
    body: ' ',
    [CALL_SESSION_ANCHOR_TYPE]: true,
    group_call_id: stableGroupCallId,
    call_session_id: stableGroupCallId,
  } as unknown as RoomMessageEventContent;
  const response = await client.sendEvent(
    roomId,
    EventType.RoomMessage,
    content,
  );
  return response.event_id ?? null;
}

/** Reuse the room-wide anchor for this Matrix group call when one already exists. */
export async function ensureCallReactionAnchor(options: {
  client: MatrixClient;
  roomId: string;
  groupCallId: string;
}): Promise<string | null> {
  const roomId = options.roomId.trim();
  const groupCallId = options.groupCallId.trim();
  if (!roomId || !groupCallId) return null;

  const room = options.client.getRoom(roomId);
  const existing = room
    ? findCallReactionAnchorEventId(
        room.getLiveTimeline()?.getEvents() ?? [],
        groupCallId,
      )
    : null;
  if (existing) return existing;

  return publishCallSessionAnchor({
    client: options.client,
    roomId,
    groupCallId,
  });
}

export async function sendCallReactionAnnotation(options: {
  client: MatrixClient;
  roomId: string;
  anchorEventId: string;
  key: string;
}): Promise<void> {
  if (!isValidReactionKey(options.key)) {
    throw new Error('Invalid reaction key');
  }
  await options.client.sendEvent(options.roomId, EventType.Reaction, {
    'm.relates_to': {
      event_id: options.anchorEventId,
      key: options.key,
      rel_type: RelationType.Annotation,
    },
  });
}

export async function sendCallRaiseHandNotice(options: {
  client: MatrixClient;
  roomId: string;
  groupCallId: string;
  raised: boolean;
}): Promise<void> {
  const stableGroupCallId = options.groupCallId.trim();
  if (!stableGroupCallId) {
    throw new Error('groupCallId is required for raise-hand notices');
  }
  const content = {
    msgtype: MsgType.Notice,
    body: ' ',
    [CALL_RAISE_HAND_NOTICE_TYPE]: true,
    [CALL_RAISE_HAND_FIELD]: options.raised,
    group_call_id: stableGroupCallId,
    call_session_id: stableGroupCallId,
  } as unknown as RoomMessageEventContent;
  await options.client.sendEvent(
    options.roomId,
    EventType.RoomMessage,
    content,
  );
}
