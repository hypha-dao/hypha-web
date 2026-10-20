import {
  EventStatus,
  EventType,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';

/** Room-message flags that never appear as a conversation the member received. */
const HIDDEN_MESSAGE_FLAGS = [
  'io.hypha.call.session_anchor.v1',
  'io.hypha.call.raise_hand.v1',
  'io.hypha.screenshare_takeover.v1',
  'io.hypha.call_capture_notice.v1',
] as const;

const IN_FLIGHT_OWN_STATUS = new Set<string>([
  EventStatus.SENDING,
  EventStatus.QUEUED,
  EventStatus.ENCRYPTING,
  EventStatus.SENT,
]);

/**
 * Messages that never appear in the conversation, so they must not raise the
 * Messages badge. Notices are automation echoes (calls, capture, team markers).
 */
function isConversationMessage(event: MatrixEvent) {
  if (event.getType() !== EventType.RoomMessage) return false;
  if (event.isRedacted()) return false;
  const content = event.getContent() as Record<string, unknown> | undefined;
  const relates = content?.['m.relates_to'] as
    | { rel_type?: string }
    | undefined;
  if (relates?.rel_type === 'm.replace') return false;
  if (content?.msgtype === 'm.notice') return false;
  if (HIDDEN_MESSAGE_FLAGS.some((flag) => content?.[flag] === true)) {
    return false;
  }
  const body = typeof content?.body === 'string' ? content.body : '';
  if (body.includes('[hypha:signal-team')) return false;
  return Boolean(event.getId());
}

function senderId(event: MatrixEvent) {
  return event.getSender() || event.sender?.userId || undefined;
}

function isOwnSender(event: MatrixEvent, selfId: string) {
  const sender = senderId(event);
  if (sender === selfId) return true;
  const status = event.status ?? null;
  return !sender && status != null && IN_FLIGHT_OWN_STATUS.has(status);
}

/** A failed local echo still belongs to this member, but it has not been sent. */
function countsAsReadCursor(event: MatrixEvent) {
  const status = event.status ?? null;
  return status !== EventStatus.NOT_SENT && status !== EventStatus.CANCELLED;
}

function eventsInRoom(room: Room) {
  const live = room.getLiveTimeline().getEvents();
  const pending =
    typeof room.getPendingEvents === 'function' ? room.getPendingEvents() : [];
  if (pending.length === 0) return live;
  const seen = new Set(
    live
      .map((event) => event.getId())
      .filter((id): id is string => Boolean(id)),
  );
  const extra = pending.filter((event) => {
    const id = event.getId();
    return !id || !seen.has(id);
  });
  return extra.length === 0 ? live : [...live, ...extra];
}

function receiptTimestamp(room: Room, selfId: string) {
  let timestamp = 0;
  const receiptId = room.getEventReadUpTo(selfId, false);
  if (receiptId) {
    timestamp = room.findEventById(receiptId)?.getTs() ?? 0;
  }
  const raw = room.getLastUnthreadedReceiptFor(selfId) as
    | { ts?: number; data?: { ts?: number } }
    | undefined;
  const fromReceipt =
    typeof raw?.ts === 'number'
      ? raw.ts
      : typeof raw?.data?.ts === 'number'
      ? raw.data.ts
      : 0;
  return Math.max(timestamp, fromReceipt);
}

/**
 * Unread direct messages from other people.
 * Sending or reading moves the cursor forward, so a room the member wrote in
 * last — or only received a notice in — stays at zero.
 */
export function countIncomingUnreadMessages(
  room: Room,
  selfId: string | null,
  isIgnoredSender: (userId: string, displayName?: string | null) => boolean,
) {
  if (!selfId) return 0;

  let ownLatestTs = 0;
  const incoming: MatrixEvent[] = [];
  for (const event of eventsInRoom(room)) {
    if (!isConversationMessage(event)) continue;
    if (isOwnSender(event, selfId)) {
      if (countsAsReadCursor(event)) {
        const ts = event.getTs() || Date.now();
        if (ts > ownLatestTs) ownLatestTs = ts;
      }
      continue;
    }
    const sender = senderId(event);
    if (!sender || isIgnoredSender(sender, event.sender?.name)) continue;
    incoming.push(event);
  }

  const readTs = receiptTimestamp(room, selfId);
  const floor = Math.max(ownLatestTs, readTs);
  const receiptId = room.getEventReadUpTo(selfId, false);
  let count = 0;

  for (const event of incoming) {
    const id = event.getId();
    if (!id) continue;
    const ts = event.getTs() || 0;
    if (receiptId) {
      const order = room.compareEventOrdering(receiptId, id);
      if (order !== null && order >= 0) continue;
      if (order !== null && order < 0) {
        if (ownLatestTs > 0 && ts <= ownLatestTs) continue;
      } else if (ts <= floor) {
        continue;
      }
    } else if (ts <= floor) {
      continue;
    }
    if (
      typeof room.hasUserReadEvent === 'function' &&
      room.hasUserReadEvent(selfId, id)
    ) {
      continue;
    }
    count += 1;
  }

  return count;
}
