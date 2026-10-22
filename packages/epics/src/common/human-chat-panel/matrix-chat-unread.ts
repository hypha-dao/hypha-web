import {
  EventType,
  NotificationCountType,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';

import {
  contentMentionsMatrixUser,
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  stripMatrixReplyFallback,
} from '@hypha-platform/core/client';

import { countIncomingUnreadMessages } from './conversation-unread-count';

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

/**
 * Non-redacted `m.replace` events per root id (single timeline pass).
 * Callers must only use a replacement when `cand.getSender() === root.getSender()`.
 */
export function replacementEventsByRootId(
  timeline: MatrixEvent[],
): Map<string, MatrixEvent[]> {
  const byRootId = new Map<string, MatrixEvent[]>();

  for (const cand of timeline) {
    const rootId = getMessageReplaceTargetEventId(cand);
    if (!rootId) continue;
    if (isRedactedRoomMessageEvent(cand)) continue;

    const list = byRootId.get(rootId) ?? [];
    list.push(cand);
    byRootId.set(rootId, list);
  }

  return byRootId;
}

/** Latest message content for mention parsing (`m.replace` edits target the root id). */
export function wireContentForMentionParse(
  rootEvent: MatrixEvent,
  replacementsByRootId: Map<string, MatrixEvent[]>,
): Record<string, unknown> | undefined {
  const rootId = rootEvent.getId();
  if (!rootId) return undefined;

  const rootSender = rootEvent.getSender();
  const candidates = replacementsByRootId.get(rootId);
  let latest = rootEvent;
  if (rootSender && candidates?.length) {
    const trusted = candidates.filter((c) => c.getSender() === rootSender);
    for (const cand of trusted) {
      if (!latest || cand.getTs() >= latest.getTs()) latest = cand;
    }
  }

  const content = latest.getContent();
  return content && typeof content === 'object'
    ? (content as Record<string, unknown>)
    : undefined;
}

function countUnreadMentionMessagesForUser(
  room: Room,
  viewerId: string,
  readUpToId: string | null,
): number {
  const timeline = room.getLiveTimeline().getEvents();
  const replacementsByRootId = replacementEventsByRootId(timeline);
  let n = 0;
  for (const ev of timeline) {
    if (ev.getType() !== EventType.RoomMessage) continue;
    if (!ev.getId() || !ev.getSender()) continue;
    if (isRedactedRoomMessageEvent(ev)) continue;
    if (getMessageReplaceTargetEventId(ev) != null) continue;

    const id = ev.getId()!;
    const sender = ev.getSender()!;
    if (sender === viewerId) continue;

    if (
      !contentMentionsMatrixUser(
        wireContentForMentionParse(ev, replacementsByRootId),
        viewerId,
      )
    ) {
      continue;
    }

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
  // Homeserver totals still count notices and hidden room events. The badge
  // should match messages a person can actually read.
  const unreadNotificationCount = countIncomingUnreadMessages(
    room,
    userId,
    isTechnicalChatSender,
  );

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

/** Sum unread @-mention notifications across every room the user has joined (space chats + DM). */
export function computeAggregateUnreadMentionCount(
  rooms: Room[],
  userId: string | null,
): { count: number; capped: boolean } {
  if (!userId || rooms.length === 0) {
    return { count: 0, capped: false };
  }
  let total = 0;
  for (const room of rooms) {
    if (room.getMyMembership() !== 'join') continue;
    const readUpToId = effectiveReadCursorEventId(room, userId);
    const localMentionCount = countUnreadMentionMessagesForUser(
      room,
      userId,
      readUpToId,
    );
    const highlight = room.getUnreadNotificationCount(
      NotificationCountType.Highlight,
    );
    const serverHighlightCount =
      typeof highlight === 'number' && highlight > 0 ? highlight : 0;
    total += Math.max(serverHighlightCount, localMentionCount);
    if (total >= 100) {
      return { count: total, capped: true };
    }
  }
  return { count: total, capped: total >= 100 };
}

export type AggregatedMentionPreview = {
  roomId: string;
  roomDisplayName: string;
  eventId: string;
  senderId: string;
  excerpt: string;
  timestamp: number;
};

/** Room title for aggregated inbox rows (canonical alias, name, or shortened id). */
export function matrixRoomShortLabel(room: Room): string {
  const canonical = room.getCanonicalAlias()?.trim();
  if (canonical) return canonical;
  const name = room.name?.trim();
  if (name) return name;
  return shortenRoomIdForDisplay(room.roomId);
}

function shortenRoomIdForDisplay(roomId: string): string {
  if (!roomId.startsWith('!')) return roomId;
  const rest = roomId.slice(1);
  const colonIdx = rest.indexOf(':');
  if (colonIdx <= 0) return roomId;
  const sigil = rest.slice(0, colonIdx);
  const domain = rest.slice(colonIdx + 1);
  const short =
    sigil.length <= 14 ? sigil : `${sigil.slice(0, 8)}…${sigil.slice(-4)}`;
  return `!${short}:${domain}`;
}

/**
 * Latest @-mention rows across joined rooms (newest first). Reuses mention detection
 * from {@link gatherMentionEvents} / timeline rules.
 */
export function gatherAggregatedMentionPreviews(
  client: MatrixClient,
  userId: string,
  limit: number,
): AggregatedMentionPreview[] {
  if (limit <= 0) return [];
  const rows: AggregatedMentionPreview[] = [];
  /** Keep newest-first; drop oldest when over `limit` (avoid materializing all rooms). */
  const pushTop = (row: AggregatedMentionPreview) => {
    rows.push(row);
    rows.sort((a, b) => b.timestamp - a.timestamp);
    if (rows.length > limit) rows.pop();
  };

  const rooms = client.getRooms().filter((r) => r.getMyMembership() === 'join');

  for (const room of rooms) {
    const timeline = room.getLiveTimeline().getEvents();
    const replacementsByRootId = replacementEventsByRootId(timeline);
    for (let i = timeline.length - 1; i >= 0; i--) {
      const ev = timeline[i];
      if (!ev) continue;
      if (ev.getType() !== EventType.RoomMessage) continue;
      if (!ev.getId()) continue;
      const sender = ev.getSender();
      if (!sender || sender === userId) continue;
      if (isRedactedRoomMessageEvent(ev)) continue;
      if (getMessageReplaceTargetEventId(ev) != null) continue;

      const wire = wireContentForMentionParse(ev, replacementsByRootId);
      if (!contentMentionsMatrixUser(wire, userId)) continue;

      const raw =
        typeof wire?.body === 'string'
          ? wire.body
          : typeof ev.getContent() === 'object' &&
            ev.getContent() &&
            typeof (ev.getContent() as { body?: string }).body === 'string'
          ? (ev.getContent() as { body: string }).body
          : '';
      const excerpt = stripMatrixReplyFallback(raw).trim().slice(0, 280);
      pushTop({
        roomId: room.roomId,
        roomDisplayName: matrixRoomShortLabel(room),
        eventId: ev.getId()!,
        senderId: sender,
        excerpt,
        timestamp: ev.getTs(),
      });
    }
  }

  return rows;
}

/** Same localpart rules as `matrixAliasLocalpart` (server) — kept client-side. */
export function chatRoomAliasLocalpart(prefix: string, slug: string): string {
  let body = '';
  for (const char of slug.trim().toLowerCase()) {
    const ok =
      (char >= 'a' && char <= 'z') ||
      (char >= '0' && char <= '9') ||
      char === '.' ||
      char === '_' ||
      char === '=' ||
      char === '-';
    body += ok ? char : '-';
  }
  let start = 0;
  let end = body.length;
  while (start < end && body[start] === '-') start += 1;
  while (end > start && body[end - 1] === '-') end -= 1;
  const safe = body.slice(start, end).slice(0, 180);
  return safe ? `${prefix}-${safe}` : prefix;
}

export const ECOSYSTEM_CHAT_ALIAS_PREFIX = 'hypha-ecosystem';
export const PUBLIC_CHAT_ALIAS_PREFIX = 'hypha-public';

/** Joined room whose canonical/alt alias matches `#localpart:…`. */
export function findJoinedRoomIdByAliasLocalpart(
  client: MatrixClient,
  localpart: string,
): string | null {
  const needle = `#${localpart.toLowerCase()}:`;
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const aliases = [
      room.getCanonicalAlias(),
      ...(room.getAltAliases() ?? []),
    ].filter((alias): alias is string => typeof alias === 'string');
    if (aliases.some((alias) => alias.toLowerCase().startsWith(needle))) {
      return room.roomId;
    }
  }
  return null;
}

function isTechnicalChatSender(userId: string, displayName?: string | null) {
  const configured = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim();
  if (configured && userId === configured) return true;
  const local = userId.replace(/^@/, '').split(':')[0] ?? '';
  return /hypha[_-]bot/i.test(local) || /hypha[_-]bot/i.test(displayName ?? '');
}

export function unreadNotificationBadgeForRoom(
  room: Room | undefined,
  userId: string | null,
): { count: number; capped: boolean } {
  const state = computeHumanChatUnreadState(room, userId);
  return {
    count: state.unreadNotificationCount,
    capped: state.unreadCountIsCapped,
  };
}
