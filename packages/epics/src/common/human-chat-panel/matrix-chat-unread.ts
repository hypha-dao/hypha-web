import { EventType, NotificationCountType, type Room } from 'matrix-js-sdk';

import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
} from '@hypha-platform/core/client';

export type HumanChatUnreadState = {
  firstUnreadMessageId: string | null;
  unreadNotificationCount: number;
  unreadCountIsCapped: boolean;
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

export function computeHumanChatUnreadState(
  room: Room | undefined,
  userId: string | null,
): HumanChatUnreadState {
  const empty: HumanChatUnreadState = {
    firstUnreadMessageId: null,
    unreadNotificationCount: 0,
    unreadCountIsCapped: false,
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
    };
  }

  return {
    firstUnreadMessageId: null,
    unreadNotificationCount,
    unreadCountIsCapped,
  };
}
