/** Matrix rich reply plaintext helpers (Client-Server API — rich replies). */

import { EventType, MatrixEventEvent, RelationType } from 'matrix-js-sdk';
import type * as MatrixSdk from 'matrix-js-sdk';

import type { Message, MessageMediaBundleItem } from './types';
import { parseMentionUserIdsFromWireContent } from './mentions';
import {
  parseSignalTeamNoticeFromWireContent,
  resolveSignalTeamUpdateDisplayBody,
} from './signal-team-events';

/** Element / Hypha custom HTML for `m.room.message` (with plaintext `body` fallback). */
export const MATRIX_CUSTOM_HTML_FORMAT = 'org.matrix.custom.html';

/** Custom field on `m.room.message` for Discord-style blurred media until click. */
export const HYPHA_SPOILER_FIELD = 'org.hypha.spoiler';

/**
 * Hypha extension: extra `m.file` / `m.image` payloads in the same event (items 1..n).
 * Root `msgtype`/`url`/`info` are item 0.
 */
export const HYPHA_MEDIA_BUNDLE_FIELD = 'org.hypha.media_bundle';

export type HyphaMediaBundleItemWire = {
  msgtype: 'm.file' | 'm.image' | 'm.audio';
  url: string;
  body?: string;
  filename?: string;
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
  };
  [key: string]: unknown;
};

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
 * Wait until a timeline event has a server-assigned id (not `~…`), e.g. before
 * sending `m.relates_to.event_id` that the homeserver must accept.
 */
export async function awaitNonProvisionalMatrixEventId(
  event: MatrixSdk.MatrixEvent,
): Promise<void> {
  const initial = event.getId();
  if (!initial || !isLocalProvisionalEventId(initial)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 30_000;
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error('Message is still sending; wait a moment and try again'),
      );
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      event.off(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
    };

    const onReplaced = () => {
      const cur = event.getId();
      if (cur && !isLocalProvisionalEventId(cur)) {
        cleanup();
        resolve();
      }
    };

    event.on(MatrixEventEvent.LocalEventIdReplaced, onReplaced);

    const cur = event.getId();
    if (cur && !isLocalProvisionalEventId(cur)) {
      cleanup();
      resolve();
    }
  });

  const finalId = event.getId();
  if (!finalId || isLocalProvisionalEventId(finalId)) {
    throw new Error('Message is still sending; wait a moment and try again');
  }
}

/**
 * When `event` is an `m.room.message` with `m.relates_to.rel_type === m.replace`,
 * returns the event id of the message being edited. Otherwise `undefined`.
 */
export function getMessageReplaceTargetEventId(
  event: MatrixSdk.MatrixEvent,
): string | undefined {
  const rel = event.getWireContent()?.['m.relates_to'] as
    | { rel_type?: string; event_id?: string }
    | undefined;
  if (
    rel?.rel_type === RelationType.Replace &&
    typeof rel.event_id === 'string' &&
    rel.event_id.length > 0
  ) {
    return rel.event_id;
  }
  return undefined;
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

  await awaitNonProvisionalMatrixEventId(target);

  const eventId = target.getId()!;

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
/**
 * Redacted `m.room.message` events still exist on the timeline; skip them so the UI
 * does not render empty rows (avatar + “You” with no body).
 */
export function isRedactedRoomMessageEvent(
  event: MatrixSdk.MatrixEvent,
): boolean {
  return (
    event.getType() === EventType.RoomMessage && event.isRedacted() === true
  );
}

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
    info?: {
      mimetype?: string;
      size?: number;
      w?: number;
      h?: number;
    };
    [key: string]: unknown;
  };
  const mentionedUserIds = parseMentionUserIdsFromWireContent(content);
  const msgtypeRaw = content.msgtype;
  const isMedia =
    msgtypeRaw === 'm.file' ||
    msgtypeRaw === 'm.image' ||
    msgtypeRaw === 'm.audio';
  const rawBody = content.body ?? '';
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
    if (!isMedia) {
      displayBody = stripMatrixReplyFallback(rawBody);
      if (
        content.format === MATRIX_CUSTOM_HTML_FORMAT &&
        typeof content.formatted_body === 'string'
      ) {
        formattedContentHtml = extractReplyFormattedHtml(
          content.formatted_body,
        );
      }
    } else if (
      content.format === MATRIX_CUSTOM_HTML_FORMAT &&
      typeof content.formatted_body === 'string'
    ) {
      formattedContentHtml = extractReplyFormattedHtml(content.formatted_body);
    }
  } else if (
    !isMedia &&
    content.format === MATRIX_CUSTOM_HTML_FORMAT &&
    typeof content.formatted_body === 'string'
  ) {
    formattedContentHtml = content.formatted_body;
  } else if (
    isMedia &&
    content.format === MATRIX_CUSTOM_HTML_FORMAT &&
    typeof content.formatted_body === 'string'
  ) {
    formattedContentHtml = content.formatted_body;
  }

  const signalTeamNotice = parseSignalTeamNoticeFromWireContent(
    content,
    rawBody,
  );
  let signalTeamNoticeField: Message['signalTeamNotice'];
  if (signalTeamNotice) {
    signalTeamNoticeField = signalTeamNotice;
    displayBody = rawBody.trim();
  } else {
    const signalTeamDisplayBody = resolveSignalTeamUpdateDisplayBody(
      content,
      rawBody,
    );
    if (signalTeamDisplayBody) {
      displayBody = signalTeamDisplayBody;
    }
  }

  const id = event.getId();
  const sender = event.getSender();
  if (!id || !sender) {
    throw new Error('Matrix room message event missing id or sender');
  }

  if (isMedia) {
    const spoilerVal = content[HYPHA_SPOILER_FIELD];
    const mxcUrl =
      typeof content.url === 'string' && content.url.startsWith('mxc://')
        ? content.url
        : undefined;
    const info = content.info;

    const mapWireToMediaInfo = (
      wire: HyphaMediaBundleItemWire | typeof content,
    ): Message['mediaInfo'] | undefined => {
      const inf = 'info' in wire ? wire.info : undefined;
      if (!inf || typeof inf !== 'object') return undefined;
      const o = inf as Record<string, unknown>;
      return {
        mimetype: typeof o.mimetype === 'string' ? o.mimetype : undefined,
        size: typeof o.size === 'number' ? o.size : undefined,
        w: typeof o.w === 'number' ? o.w : undefined,
        h: typeof o.h === 'number' ? o.h : undefined,
        duration: typeof o.duration === 'number' ? o.duration : undefined,
      };
    };

    const parseBundleItem = (wire: unknown): MessageMediaBundleItem => {
      const w = wire as HyphaMediaBundleItemWire;
      const mt =
        w.msgtype === 'm.file' ||
        w.msgtype === 'm.image' ||
        w.msgtype === 'm.audio'
          ? w.msgtype
          : 'm.file';
      const url =
        typeof w.url === 'string' && w.url.startsWith('mxc://') ? w.url : '';
      const fn =
        typeof w.filename === 'string'
          ? w.filename
          : typeof w.body === 'string'
          ? w.body
          : '';
      const sp = w[HYPHA_SPOILER_FIELD] === true;
      return {
        msgtype: mt,
        mxcUrl: url || undefined,
        filename: fn || undefined,
        mediaInfo: mapWireToMediaInfo(w),
        spoiler: sp,
      };
    };

    const bundleRaw = content[HYPHA_MEDIA_BUNDLE_FIELD];
    let mediaBundle: Message['mediaBundle'];
    if (Array.isArray(bundleRaw) && bundleRaw.length > 0) {
      const first = {
        msgtype: msgtypeRaw as 'm.file' | 'm.image' | 'm.audio',
        mxcUrl,
        filename:
          typeof content.filename === 'string'
            ? content.filename
            : rawBody || undefined,
        mediaInfo: mapWireToMediaInfo(content),
        spoiler: spoilerVal === true,
      };
      const rest = bundleRaw.map(parseBundleItem).filter((x) => x.mxcUrl);
      mediaBundle = [first, ...rest];
    } else {
      mediaBundle = undefined;
    }

    return {
      id,
      sender,
      msgtype: msgtypeRaw as Message['msgtype'],
      content: rawBody,
      formattedContentHtml,
      timestamp: new Date(event.getTs()),
      pinned,
      inReplyToEventId: replyToId,
      inReplyToSender,
      inReplyToBodyPreview,
      mxcUrl,
      filename:
        typeof content.filename === 'string'
          ? content.filename
          : rawBody || undefined,
      mediaInfo: info
        ? {
            mimetype: info.mimetype,
            size: info.size,
            w: info.w,
            h: info.h,
          }
        : undefined,
      spoiler: spoilerVal === true,
      mediaBundle,
      ...(mentionedUserIds ? { mentionedUserIds } : {}),
    };
  }

  return {
    id,
    sender,
    content: displayBody,
    formattedContentHtml,
    timestamp: new Date(event.getTs()),
    pinned,
    inReplyToEventId: replyToId,
    inReplyToSender,
    inReplyToBodyPreview,
    ...(mentionedUserIds ? { mentionedUserIds } : {}),
    ...(signalTeamNoticeField
      ? { signalTeamNotice: signalTeamNoticeField }
      : {}),
  };
}
