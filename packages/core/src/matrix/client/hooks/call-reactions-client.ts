'use client';

import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { isValidReactionKey } from '../../reactions';
import {
  CALL_RAISE_HAND_FIELD,
  CALL_RAISE_HAND_NOTICE_TYPE,
  CALL_SESSION_ANCHOR_TYPE,
} from './call-reactions';

export async function publishCallSessionAnchor(options: {
  client: MatrixClient;
  roomId: string;
  callSessionId: string;
}): Promise<string | null> {
  const { client, roomId, callSessionId } = options;
  const content = {
    msgtype: MsgType.Notice,
    body: ' ',
    [CALL_SESSION_ANCHOR_TYPE]: true,
    call_session_id: callSessionId,
  } as unknown as RoomMessageEventContent;
  const response = await client.sendEvent(
    roomId,
    EventType.RoomMessage,
    content,
  );
  return response.event_id ?? null;
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
  raised: boolean;
}): Promise<void> {
  const content = {
    msgtype: MsgType.Notice,
    body: ' ',
    [CALL_RAISE_HAND_NOTICE_TYPE]: true,
    [CALL_RAISE_HAND_FIELD]: options.raised,
  } as unknown as RoomMessageEventContent;
  await options.client.sendEvent(
    options.roomId,
    EventType.RoomMessage,
    content,
  );
}
