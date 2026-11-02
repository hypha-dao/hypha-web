'use client';

import React from 'react';
import {
  ClientEvent,
  EventType,
  RoomEvent,
  type MatrixClient,
} from 'matrix-js-sdk';
import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  isSignalDescriptionAnchorMessage,
  useMatrix,
} from '@hypha-platform/core/client';
import { isHyphaBotMatrixIdentity } from '../../common/human-chat-panel/matrix-room-member-display';

export type SignalRoomActivity = {
  /** Replies in the loaded live timeline; the description seed is not a reply. */
  comments: number;
  /** Distinct people who replied. */
  people: number;
  lastReplyAt: number | null;
  lastReplySenderName: string | null;
};

type SignalRoomRef = {
  roomId?: string | null;
  description?: string | null;
};

function readRoomActivity(
  client: MatrixClient,
  roomId: string,
  description: string | null | undefined,
): SignalRoomActivity | null {
  const room = client.getRoom(roomId);
  if (!room || room.getMyMembership() !== 'join') return null;

  const events = room.getLiveTimeline().getEvents();
  // The seed can only be recognised when the timeline reaches the room start.
  let anchorPending = events.some(
    (event) => event.getType() === EventType.RoomCreate,
  );
  const senders = new Set<string>();
  let comments = 0;
  let lastReplyAt: number | null = null;
  let lastSenderId: string | null = null;

  for (const event of events) {
    if (event.getType() !== EventType.RoomMessage) continue;
    if (isRedactedRoomMessageEvent(event)) continue;
    if (getMessageReplaceTargetEventId(event) != null) continue;
    const sender = event.getSender();
    if (!sender || isHyphaBotMatrixIdentity(sender)) continue;
    if (anchorPending) {
      anchorPending = false;
      const body = (event.getContent() as { body?: unknown })?.body;
      if (
        isSignalDescriptionAnchorMessage({
          isFirstChatTextMessage: true,
          messageContent: typeof body === 'string' ? body : null,
          signalDescription: description,
        })
      ) {
        continue;
      }
    }
    comments += 1;
    senders.add(sender);
    lastReplyAt = event.getTs();
    lastSenderId = sender;
  }

  return {
    comments,
    people: senders.size,
    lastReplyAt,
    lastReplySenderName: lastSenderId
      ? room.getMember(lastSenderId)?.name ?? null
      : null,
  };
}

/**
 * Reply counts and last reply per signal room, read from the viewer's Matrix
 * sync. Rooms the viewer has not joined are missing from the result.
 */
export function useSignalRoomActivity(
  rooms: readonly SignalRoomRef[],
): Record<string, SignalRoomActivity> {
  const { client } = useMatrix();
  const [version, setVersion] = React.useState(0);

  const roomKey = rooms
    .map((room) => room.roomId?.trim() ?? '')
    .filter(Boolean)
    .join('|');

  React.useEffect(() => {
    if (!client || !roomKey) return;
    const watched = new Set(roomKey.split('|'));
    let frame: number | null = null;
    const bump = () => {
      if (frame != null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setVersion((value) => value + 1);
      });
    };
    const onTimeline = (
      _event: unknown,
      room: { roomId?: string } | undefined,
    ) => {
      if (room?.roomId && watched.has(room.roomId)) bump();
    };
    client.on(RoomEvent.Timeline, onTimeline);
    client.on(ClientEvent.Room, bump);
    client.on(ClientEvent.Sync, bump);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      client.off(RoomEvent.Timeline, onTimeline);
      client.off(ClientEvent.Room, bump);
      client.off(ClientEvent.Sync, bump);
    };
  }, [client, roomKey]);

  return React.useMemo(() => {
    const result: Record<string, SignalRoomActivity> = {};
    if (!client) return result;
    for (const room of rooms) {
      const roomId = room.roomId?.trim();
      if (!roomId) continue;
      const activity = readRoomActivity(client, roomId, room.description);
      if (activity) result[roomId] = activity;
    }
    return result;
    // `version` re-reads the timelines after Matrix events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, rooms, version]);
}
