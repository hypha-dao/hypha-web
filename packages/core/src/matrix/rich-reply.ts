/** Matrix rich reply plaintext helpers (Client-Server API — rich replies). */

import { MatrixEventEvent } from 'matrix-js-sdk';
import type * as MatrixSdk from 'matrix-js-sdk';

import type { Message } from './types';

/** Element / Hypha custom HTML for `m.room.message` (with plaintext `body` fallback). */
export const MATRIX_CUSTOM_HTML_FORMAT = 'org.matrix.custom.html';

export const RICH_REPLY_PREVIEW_MAX = 280;

/** Single-line reply excerpt (Discord-style): first line only, then optional char cap. */
export const REPLY_PREVIEW_LINE_MAX = 120;

/**
 * First visible line of text for reply banners (no multi-line quotes in UI).
 */
export function firstLineForReplyPreview(
  text: string,
  maxChars = REPLY_PREVIEW_LINE_MAX,
): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const firstLine = normalized.split('\n')[0]?.trim() ?? '';
  if (firstLine.length <= maxChars) return firstLine;
  return `${firstLine.slice(0, Math.max(0, maxChars - 1))}…`;
}

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

/** Split `buildRichReplyPlainBody` output into quoted fallback vs new reply text. */
export function splitRichReplyPlainBody(plainBody: string): {
  quoted: string;
  reply: string;
} {
  const normalized = plainBody.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('\n\n');
  if (idx === -1) {
    return { quoted: '', reply: normalized };
  }
  return {
    quoted: normalized.slice(0, idx),
    reply: normalized.slice(idx + 2),
  };
}

const REPLY_FORMATTED_HTML_SEP = '<br /><br />';

/** After rich-reply Matrix HTML, the new reply HTML follows the first `<br /><br />`. */
export function extractReplyFormattedHtml(formattedBody: string): string {
  const i = formattedBody.indexOf(REPLY_FORMATTED_HTML_SEP);
  if (i === -1) return formattedBody;
  return formattedBody.slice(i + REPLY_FORMATTED_HTML_SEP.length);
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
  const content = event.getContent() as {
    body?: string;
    format?: string;
    formatted_body?: string;
    msgtype?: string;
    url?: string;
    filename?: string;
  };
  const msgType = content.msgtype;
  const mediaMxcUrl =
    msgType === 'm.image' || msgType === 'm.video' || msgType === 'm.file'
      ? typeof content.url === 'string'
        ? content.url
        : undefined
      : undefined;

  const rawBody = content.body ?? '';
  const mediaFileName =
    msgType === 'm.file' && typeof content.filename === 'string'
      ? content.filename
      : undefined;
  const replyToId = event.getWireContent()?.['m.relates_to']?.['m.in_reply_to']
    ?.event_id as string | undefined;

  let inReplyToSender: string | undefined;
  let inReplyToBodyPreview: string | undefined;
  let displayBody = rawBody;
  let formattedContentHtml: string | undefined;

  if (replyToId) {
    const room = client.getRoom(roomId);
    const parent = room?.findEventById(replyToId);
    if (parent) {
      inReplyToSender = parent.getSender() ?? undefined;
      const parentBody = (parent.getContent().body as string | undefined) ?? '';
      const parentVisible = stripMatrixReplyFallback(parentBody).trim();
      if (parent.isRedacted() || !parentVisible) {
        inReplyToBodyPreview = undefined;
      } else {
        inReplyToBodyPreview = firstLineForReplyPreview(parentVisible);
      }
    } else {
      const parsed = parseReplyFallbackFirstLine(rawBody);
      if (parsed) {
        inReplyToSender = parsed.sender;
        inReplyToBodyPreview = firstLineForReplyPreview(parsed.previewLine);
      }
    }
    displayBody = stripMatrixReplyFallback(rawBody);
    if (
      content.format === MATRIX_CUSTOM_HTML_FORMAT &&
      typeof content.formatted_body === 'string'
    ) {
      formattedContentHtml = extractReplyFormattedHtml(content.formatted_body);
    }
  } else if (
    content.format === MATRIX_CUSTOM_HTML_FORMAT &&
    typeof content.formatted_body === 'string'
  ) {
    formattedContentHtml = content.formatted_body;
  }

  const id = event.getId();
  const sender = event.getSender();
  if (!id || !sender) {
    throw new Error('Matrix room message event missing id or sender');
  }

  return {
    id,
    sender,
    msgType,
    mediaMxcUrl,
    mediaFileName,
    content: displayBody,
    formattedContentHtml,
    timestamp: new Date(event.getTs()),
    pinned,
    inReplyToEventId: replyToId,
    inReplyToSender,
    inReplyToBodyPreview,
  };
}
