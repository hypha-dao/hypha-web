import { sanitizeMentionIds } from '../../actions/notify-chat-mention.utils';
import type { MatrixEvent, ParsedMessageEvent } from './types';

const MATRIX_TO_PILL = /matrix\.to\/#\/((?:@|%40)[^"'?/#\s]+)/g;

const MXID_RE = /^@[^:\s]+:[^:\s]+$/;

/** Pull mentioned MXIDs from `m.mentions` (MSC3952) first, else matrix.to pills in the HTML body. */
function extractMentions(event: MatrixEvent): string[] {
  const explicit = event.content?.['m.mentions']?.user_ids;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return sanitizeMentionIds(explicit).filter((id) => MXID_RE.test(id));
  }

  const formatted = event.content?.formatted_body;
  if (typeof formatted !== 'string' || formatted.length === 0) return [];

  const found: string[] = [];
  for (const match of formatted.matchAll(MATRIX_TO_PILL)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const decoded = decodeURIComponent(raw);
      if (MXID_RE.test(decoded)) found.push(decoded);
    } catch {
      // malformed escape — skip
    }
  }
  return sanitizeMentionIds(found);
}

/**
 * Normalise a raw Matrix event, or return `null` when it isn't a member-authored chat message the
 * receiver should act on:
 *  - not `m.room.message`  (state events, membership, reactions, redactions, …)
 *  - missing `event_id` / `room_id` / `sender`
 *  - `m.notice`            (bot/automation echoes)
 *
 * Bot-sender suppression is applied later (`receiveTransaction`), where the bot MXID list lives.
 */
export function parseMessageEvent(
  event: MatrixEvent,
): ParsedMessageEvent | null {
  if (event.type !== 'm.room.message') return null;

  const matrixEventId = event.event_id?.trim();
  const roomId = event.room_id?.trim();
  const senderMxid = event.sender?.trim();
  if (!matrixEventId || !roomId || !senderMxid) return null;

  const msgtype = event.content?.msgtype;
  if (msgtype === 'm.notice') return null;

  const body =
    typeof event.content?.body === 'string' ? event.content.body : '';

  const occurredAt =
    typeof event.origin_server_ts === 'number' && event.origin_server_ts > 0
      ? event.origin_server_ts
      : Date.now();

  return {
    matrixEventId,
    roomId,
    senderMxid,
    body,
    mentionedMatrixUserIds: extractMentions(event),
    occurredAt,
  };
}
