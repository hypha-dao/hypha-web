'use client';

import React from 'react';
import {
  ClientEvent,
  EventType,
  RoomEvent,
  SyncState,
  UserEvent,
  type MatrixClient,
} from 'matrix-js-sdk';
import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  useMatrix,
} from '@hypha-platform/core/client';
import {
  isHyphaBotMatrixIdentity,
  pickUserVisibleMemberLabel,
} from '../../common/human-chat-panel/matrix-room-member-display';
import {
  sameSignalRoomActivity,
  summarizeSignalReplies,
  type SignalRoomMessage,
} from '../utils/signal-room-replies';

export type SignalRoomActivity = {
  /** Replies in the loaded live timeline; description copies are not replies. */
  comments: number;
  /** Distinct people who replied. */
  people: number;
  lastReplyAt: number | null;
  lastReplySenderId: string | null;
  /** Matrix display name, only when it is a real name (never a bridged id). */
  lastReplySenderName: string | null;
  /**
   * Whether the loaded timeline goes back to the room start. When false the
   * counts only cover the recent tail, so callers fall back to stored totals.
   */
  reachesRoomStart: boolean;
};

type SignalRoomRef = {
  roomId?: string | null;
  description?: string | null;
};

function messageBody(content: unknown): string | null {
  const body = (content as { body?: unknown } | null)?.body;
  return typeof body === 'string' ? body : null;
}

function readRoomActivity(
  client: MatrixClient,
  roomId: string,
  description: string | null | undefined,
): SignalRoomActivity | null {
  const room = client.getRoom(roomId);
  if (!room || room.getMyMembership() !== 'join') return null;

  const events = room.getLiveTimeline().getEvents();
  const reachesRoomStart = events.some(
    (event) => event.getType() === EventType.RoomCreate,
  );
  const editedBodies = new Map<string, string>();
  for (const event of events) {
    if (event.getType() !== EventType.RoomMessage) continue;
    const target = getMessageReplaceTargetEventId(event);
    if (!target) continue;
    const next = messageBody(
      (event.getContent() as { 'm.new_content'?: unknown })['m.new_content'],
    );
    if (next != null) editedBodies.set(target, next);
  }

  const messages: SignalRoomMessage[] = [];
  for (const event of events) {
    if (event.getType() !== EventType.RoomMessage) continue;
    if (isRedactedRoomMessageEvent(event)) continue;
    if (getMessageReplaceTargetEventId(event) != null) continue;
    const sender = event.getSender();
    if (!sender) continue;
    const eventId = event.getId();
    messages.push({
      sender,
      ts: event.getTs(),
      body: messageBody(event.getContent()),
      editedBody: eventId ? editedBodies.get(eventId) ?? null : null,
    });
  }

  const summary = summarizeSignalReplies(messages, description, {
    isBot: (sender) => isHyphaBotMatrixIdentity(sender),
  });
  const member = summary.lastReplySenderId
    ? room.getMember(summary.lastReplySenderId)
    : null;
  return {
    ...summary,
    lastReplySenderName:
      summary.lastReplySenderId && member
        ? pickUserVisibleMemberLabel(
            summary.lastReplySenderId,
            member.name,
            member.user?.displayName,
            member.rawDisplayName,
          )
        : null,
    reachesRoomStart,
  };
}

/** Filtered reply count once the caller's Matrix client has this room. */
export function readSignalRoomDiscussionCount(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined,
  description?: string | null,
): { comments: number; reachesRoomStart: boolean } | null {
  const id = roomId?.trim();
  if (!client || !id) return null;
  const activity = readRoomActivity(client, id, description);
  if (!activity) return null;
  return {
    comments: activity.comments,
    reachesRoomStart: activity.reachesRoomStart,
  };
}

function readAllActivity(
  client: MatrixClient | null | undefined,
  rooms: readonly SignalRoomRef[],
): Record<string, SignalRoomActivity> {
  const result: Record<string, SignalRoomActivity> = {};
  if (!client) return result;
  for (const room of rooms) {
    const roomId = room.roomId?.trim();
    if (!roomId) continue;
    const activity = readRoomActivity(client, roomId, room.description);
    if (activity) result[roomId] = activity;
  }
  return result;
}

function sameActivityMap(
  a: Record<string, SignalRoomActivity>,
  b: Record<string, SignalRoomActivity>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const next = b[key];
    return next != null && sameSignalRoomActivity(a[key]!, next);
  });
}

/**
 * Reply counts and last reply per signal room, read from the viewer's Matrix
 * sync. Rooms the viewer has not joined are missing from the result. The
 * value only changes when a count or the last reply changes, so typing and
 * other sync traffic do not re-render callers.
 */
export function useSignalRoomActivity(
  rooms: readonly SignalRoomRef[],
): Record<string, SignalRoomActivity> {
  const { client } = useMatrix();
  const [activity, setActivity] = React.useState<
    Record<string, SignalRoomActivity>
  >(() => readAllActivity(client, rooms));

  React.useEffect(() => {
    const refresh = () => {
      const next = readAllActivity(client, rooms);
      setActivity((prev) => (sameActivityMap(prev, next) ? prev : next));
    };
    refresh();
    if (!client) return;
    const watched = new Set(
      rooms.map((room) => room.roomId?.trim() ?? '').filter(Boolean),
    );
    if (watched.size === 0) return;
    let frame: number | null = null;
    const schedule = () => {
      if (frame != null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        refresh();
      });
    };
    const onTimeline = (
      _event: unknown,
      room: { roomId?: string } | undefined,
    ) => {
      if (room?.roomId && watched.has(room.roomId)) schedule();
    };
    const timelineCursor = (roomId: string): string | null => {
      const events = client.getRoom(roomId)?.getLiveTimeline().getEvents();
      if (!events?.length) return null;
      const last = events[events.length - 1];
      return `${events.length}:${events[0]?.getId() ?? ''}:${
        last?.getId() ?? ''
      }`;
    };
    const cursors = new Map<string, string | null>();
    for (const roomId of watched) cursors.set(roomId, timelineCursor(roomId));
    // Sync fires for typing, receipts and presence too. Rescan only when the
    // initial sync lands, or when a watched room's live timeline actually moved.
    const onSync = (state: SyncState, prevState: SyncState | null) => {
      const prepared =
        state === SyncState.Prepared && prevState !== SyncState.Prepared;
      let timelineChanged = false;
      for (const roomId of watched) {
        const next = timelineCursor(roomId);
        if (cursors.get(roomId) === next) continue;
        cursors.set(roomId, next);
        timelineChanged = true;
      }
      if (prepared || timelineChanged) schedule();
    };
    client.on(RoomEvent.Timeline, onTimeline);
    client.on(ClientEvent.Room, schedule);
    client.on(ClientEvent.Sync, onSync);
    client.on(UserEvent.DisplayName, schedule);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      client.off(RoomEvent.Timeline, onTimeline);
      client.off(ClientEvent.Room, schedule);
      client.off(ClientEvent.Sync, onSync);
      client.off(UserEvent.DisplayName, schedule);
    };
  }, [client, rooms]);

  return activity;
}
