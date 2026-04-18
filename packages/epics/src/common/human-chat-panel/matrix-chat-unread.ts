import { EventType, NotificationCountType, type Room } from 'matrix-js-sdk';

import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  parseMentionUserIdsFromWireContent,
} from '@hypha-platform/core/client';

export type HumanChatUnreadState = {
  firstUnreadMessageId: string | null;
  unreadNotificationCount: number;
  unreadCountIsCapped: boolean;
  /** Matrix highlight notifications only (@mentions etc.); use for tab/bell badges. */
  unreadMentionCount: number;
  mentionCountIsCapped: boolean;
};

/**
 * Derives Discord-style unread boundary + banner counts from Matrix room model.
 */
function effectiveReadCursorEventId(room: Room, userId: string): string | null {
  const receiptId = room.getEventReadUpTo(userId, false);
  const fullyReadEv = room.getAccountData?.('m.fully_read');
  const fullyReadId =
    (fullyReadEv?.getContent?.() as { event_id?: string } | undefined)
      ?.event_id ?? null;

  if (receiptId && fullyReadId) {
    const cmp = room.compareEventOrdering(receiptId, fullyReadId);
    if (cmp === null) return receiptId;
    return cmp >= 0 ? receiptId : fullyReadId;
  }
  return receiptId ?? fullyReadId ?? null;
}

/**
 * Count room messages that @-mention the viewer and are still unread by read-receipt
 * cursor. Used when `NotificationCountType.Highlight` from the server is 0 (some
 * homeservers do not populate highlight counts reliably).
 */
function countUnreadMentionMessagesForUser(
  room: Room,
  viewerId: string,
  readUpToId: string | null,
): number {
  const timeline = room.getLiveTimeline().getEvents();
  let n = 0;
  for (const ev of timeline) {
    if (ev.getType() !== EventType.RoomMessage) continue;
    if (!ev.getId() || !ev.getSender()) continue;
    if (isRedactedRoomMessageEvent(ev)) continue;
    if (getMessageReplaceTargetEventId(ev) != null) continue;

    const id = ev.getId()!;
    const sender = ev.getSender()!;
    if (sender === viewerId) continue;

    const ids = parseMentionUserIdsFromWireContent(ev.getContent());
    if (!ids?.includes(viewerId)) continue;

    if (readUpToId) {
      const cmp = room.compareEventOrdering(readUpToId, id);
      if (cmp !== null && cmp >= 0) continue;
    }

    if (
      typeof room.hasUserReadEvent === 'function' &&
      room.hasUserReadEvent(viewerId, id)
    ) {
      continue;
    }

    n += 1;
  }
  return n;
}

export function computeHumanChatUnreadState(
  room: Room | undefined,
  userId: string | null,
): HumanChatUnreadState {
  const empty: HumanChatUnreadState = {
    firstUnreadMessageId: null,
    unreadNotificationCount: 0,
    unreadCountIsCapped: false,
    unreadMentionCount: 0,
    mentionCountIsCapped: false,
  };

  if (!room || !userId) return empty;

  const highlight = room.getUnreadNotificationCount(
    NotificationCountType.Highlight,
  );
  const total = room.getUnreadNotificationCount(NotificationCountType.Total);
  const unreadNotificationCount =
    typeof highlight === 'number' && highlight > 0 ? highlight : total ?? 0;

  const unreadCountIsCapped = unreadNotificationCount >= 100;

  const readUpToId = effectiveReadCursorEventId(room, userId);

  const serverHighlightCount =
    typeof highlight === 'number' && highlight > 0 ? highlight : 0;
  const localMentionCount = countUnreadMentionMessagesForUser(
    room,
    userId,
    readUpToId,
  );
  const unreadMentionCount = Math.max(serverHighlightCount, localMentionCount);
  const mentionCountIsCapped = unreadMentionCount >= 100;

  const timeline = room.getLiveTimeline().getEvents();

  for (const ev of timeline) {
    if (ev.getType() !== EventType.RoomMessage) continue;
    if (!ev.getId() || !ev.getSender()) continue;
    if (isRedactedRoomMessageEvent(ev)) continue;
    if (getMessageReplaceTargetEventId(ev) != null) continue;

    const id = ev.getId()!;
    const sender = ev.getSender()!;
    if (sender === userId) continue;

    if (readUpToId) {
      const cmp = room.compareEventOrdering(readUpToId, id);
      if (cmp !== null && cmp >= 0) {
        continue;
      }
    }

    if (
      typeof room.hasUserReadEvent === 'function' &&
      room.hasUserReadEvent(userId, id)
    ) {
      continue;
    }

    return {
      firstUnreadMessageId: id,
      unreadNotificationCount,
      unreadCountIsCapped,
      unreadMentionCount,
      mentionCountIsCapped,
    };
  }

  return {
    firstUnreadMessageId: null,
    unreadNotificationCount,
    unreadCountIsCapped,
    unreadMentionCount,
    mentionCountIsCapped,
  };
}
