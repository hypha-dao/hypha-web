/** Matrix rich reply plaintext helpers (Client-Server API — rich replies). */

import { MatrixEventEvent } from 'matrix-js-sdk';
import type * as MatrixSdk from 'matrix-js-sdk';

import type { Message } from './types';

export const RICH_REPLY_PREVIEW_MAX = 280;

/** Local / optimistic event ids start with `~` until the homeserver assigns `$…`. */
export function isLocalProvisionalEventId(eventId: string): boolean {
  return eventId.startsWith('~');
}

/**
 * Resolve the target message for a rich reply, waiting if the UI still holds a
 * provisional `~…` id (outbound echo not yet received).
 */
export async function resolveReplyTargetForSend(
  client: MatrixSdk.MatrixClient,
  roomId: string,
  replyToEventId: string,
): Promise<{ eventId: string; sender: string; body: string }> {
  const room = client.getRoom(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  let target =
    room.findEventById(replyToEventId) ??
    (typeof room.getPendingEvent === 'function'
      ? room.getPendingEvent(replyToEventId)
      : null) ??
    undefined;

  if (!target && !isLocalProvisionalEventId(replyToEventId)) {
    try {
      const raw = await client.fetchRoomEvent(roomId, replyToEventId);
      target = client.getEventMapper()(raw as MatrixSdk.IEvent);
    } catch {
      target = undefined;
    }
  }

  if (!target) {
    throw new Error('Reply target message not found');
  }

  if (isLocalProvisionalEventId(target.getId()!)) {
    await new Promise<void>((resolve, reject) => {
      const timeoutMs = 30_000;
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'Reply target is still sending; wait a moment and try again',
          ),
        );
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        target!.off(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
      };

      const onReplaced = () => {
        if (!isLocalProvisionalEventId(target!.getId()!)) {
          cleanup();
          resolve();
        }
      };

      target.on(MatrixEventEvent.LocalEventIdReplaced, onReplaced);

      if (!isLocalProvisionalEventId(target.getId()!)) {
        cleanup();
        resolve();
      }
    });
  }

  const eventId = target.getId()!;
  if (isLocalProvisionalEventId(eventId)) {
    throw new Error(
      'Reply target is still sending; wait a moment and try again',
    );
  }

  const sender = target.getSender();
  if (!sender) {
    throw new Error('Reply target has no sender');
  }
  const body = (target.getContent().body as string | undefined) ?? '';
  return { eventId, sender, body };
}

export function truncateForPreview(
  text: string,
  max = RICH_REPLY_PREVIEW_MAX,
): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Strip the quoted block from a rich-reply fallback body so the bubble shows only the new text.
 */
export function stripMatrixReplyFallback(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('\n\n');
  if (idx === -1) return body;
  const head = normalized.slice(0, idx);
  const headLines = head.split('\n');
  const isQuotedBlock = headLines.every(
    (line) => line.startsWith('>') || line.trim() === '',
  );
  if (!isQuotedBlock) return body;
  return normalized.slice(idx + 2).trimEnd();
}

/**
 * Build plaintext body for an m.in_reply_to message (fallback for non-rich clients).
 */
export function buildRichReplyPlainBody(
  targetSenderMxid: string,
  targetBody: string,
  replyText: string,
): string {
  const cleanTarget = stripMatrixReplyFallback(targetBody.trim());
  const safeReply = replyText.trim();
  const lines = cleanTarget.length > 0 ? cleanTarget.split('\n') : [''];
  const first = lines[0] ?? '';
  const rest = lines.slice(1);
  const quoted = [
    `> <${targetSenderMxid}> ${first}`,
    ...rest.map((l) => `> ${l}`),
  ].join('\n');
  return `${quoted}\n\n${safeReply}`;
}

/**
 * Parse first line of Matrix rich-reply fallback: `> <@user:hs> text`
 */
function parseReplyFallbackFirstLine(body: string): {
  sender: string;
  previewLine: string;
} | null {
  const normalized = body.replace(/\r\n/g, '\n');
  const firstLine = normalized.split('\n')[0];
  if (!firstLine) return null;
  const m = firstLine.match(/^>\s*<(@.+?:.+?)>\s*(.*)$/);
  if (!m || m[1] == null) return null;
  return { sender: m[1], previewLine: m[2] ?? '' };
}

/**
 * Map a timeline `m.room.message` event to Hypha `Message` (reply metadata + display body).
 */
export function messageFromRoomMessageEvent(
  client: MatrixSdk.MatrixClient,
  roomId: string,
  event: MatrixSdk.MatrixEvent,
  pinned: boolean,
): Message {
  const rawBody = (event.getContent().body as string | undefined) ?? '';
  const replyToId = event.getWireContent()?.['m.relates_to']?.['m.in_reply_to']
    ?.event_id as string | undefined;

  let inReplyToSender: string | undefined;
  let inReplyToBodyPreview: string | undefined;
  let displayBody = rawBody;

  if (replyToId) {
    const room = client.getRoom(roomId);
    const parent = room?.findEventById(replyToId);
    if (parent) {
      inReplyToSender = parent.getSender() ?? undefined;
      const parentBody = (parent.getContent().body as string | undefined) ?? '';
      if (parent.isRedacted() || !parentBody.trim()) {
        inReplyToBodyPreview = undefined;
      } else {
        inReplyToBodyPreview = truncateForPreview(parentBody);
      }
    } else {
      const parsed = parseReplyFallbackFirstLine(rawBody);
      if (parsed) {
        inReplyToSender = parsed.sender;
        inReplyToBodyPreview = truncateForPreview(parsed.previewLine);
      }
    }
    displayBody = stripMatrixReplyFallback(rawBody);
  }

  return {
    id: event.getId()!,
    sender: event.getSender()!,
    content: displayBody,
    timestamp: new Date(event.getTs()),
    pinned,
    inReplyToEventId: replyToId,
    inReplyToSender,
    inReplyToBodyPreview,
  };
}
