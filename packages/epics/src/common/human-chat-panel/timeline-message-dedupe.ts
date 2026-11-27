import { asTimelineDate } from './human-chat-timeline-order';

/** Local echo and its homeserver copy can both sit in the timeline for a short while. */
const ECHO_WINDOW_MS = 2 * 60 * 1000;

export type DedupableTimelineMessage = {
  id?: string;
  role?: string;
  senderMatrixId?: string;
  timestamp?: Date | string | number;
  sendAcknowledged?: boolean;
  sendPending?: { captionPreview?: string } | null;
  parts?: ReadonlyArray<{ type?: string; text?: string }>;
  media?: unknown;
  mediaSlots?: readonly unknown[] | null;
};

function messageText(message: DedupableTimelineMessage): string {
  return (message.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text?.trim() ?? '' : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function hasMedia(message: DedupableTimelineMessage): boolean {
  return Boolean(
    message.media || (message.mediaSlots && message.mediaSlots.length > 0),
  );
}

function timestampMs(message: DedupableTimelineMessage): number | null {
  const date = asTimelineDate(message.timestamp);
  return date ? date.getTime() : null;
}

function mediaKey(message: DedupableTimelineMessage): string {
  const slots: unknown[] = [];
  if (message.media) slots.push(message.media);
  if (message.mediaSlots) slots.push(...message.mediaSlots);
  return slots
    .map((slot) => {
      if (!slot || typeof slot !== 'object') return '';
      const url = (slot as { mxcUrl?: unknown }).mxcUrl;
      return typeof url === 'string' ? url.trim() : '';
    })
    .filter(Boolean)
    .sort()
    .join('\n');
}

function isPendingSend(message: DedupableTimelineMessage): boolean {
  const id = message.id ?? '';
  return Boolean(message.sendPending) || id.startsWith('hypha-send-pending');
}

function isUnackedEcho(message: DedupableTimelineMessage): boolean {
  if (isPendingSend(message)) return false;
  const id = message.id ?? '';
  if (id.startsWith('~')) return true;
  return message.sendAcknowledged === false;
}

function richness(message: DedupableTimelineMessage): number {
  let score = 0;
  if (message.sendAcknowledged !== false) score += 4;
  if (messageText(message)) score += 2;
  if (hasMedia(message)) score += 2;
  if (isPendingSend(message)) score -= 3;
  if ((message.id ?? '').startsWith('~')) score -= 4;
  return score;
}

function isSelf(
  message: DedupableTimelineMessage,
  selfId: string | null | undefined,
): boolean {
  if (message.role === 'user') return true;
  const self = selfId?.trim();
  return Boolean(self && message.senderMatrixId?.trim() === self);
}

function sameAuthor(
  left: DedupableTimelineMessage,
  right: DedupableTimelineMessage,
  selfId: string | null | undefined,
): boolean {
  if (isSelf(left, selfId) || isSelf(right, selfId)) {
    return isSelf(left, selfId) && isSelf(right, selfId);
  }
  const leftId = left.senderMatrixId?.trim();
  const rightId = right.senderMatrixId?.trim();
  return Boolean(leftId && rightId && leftId === rightId);
}

function withinEchoWindow(
  left: DedupableTimelineMessage,
  right: DedupableTimelineMessage,
): boolean {
  const leftTs = timestampMs(left);
  const rightTs = timestampMs(right);
  if (leftTs == null || rightTs == null) return false;
  return Math.abs(leftTs - rightTs) <= ECHO_WINDOW_MS;
}

function echoMatchesReal(
  echo: DedupableTimelineMessage,
  real: DedupableTimelineMessage,
): boolean {
  const echoText =
    messageText(echo) || echo.sendPending?.captionPreview?.trim() || '';
  const realText = messageText(real);
  if (echoText && realText && echoText !== realText) return false;
  const echoMedia = mediaKey(echo);
  const realMedia = mediaKey(real);
  if (echoMedia && realMedia && echoMedia !== realMedia) return false;
  const textMatch = Boolean(echoText && realText && echoText === realText);
  const echoTs = timestampMs(echo);
  const realTs = timestampMs(real);
  if (textMatch) {
    if (echoTs == null || realTs == null) return true;
    return Math.abs(echoTs - realTs) <= ECHO_WINDOW_MS;
  }
  // A captionless upload with no clock must not attach to an older text row.
  if (!echoText && realText && (echoTs == null || realTs == null)) return false;
  if (!echoText && !realText && (hasMedia(echo) || hasMedia(real))) {
    if (!echoMedia || !realMedia || echoMedia !== realMedia) return false;
  }
  if (!echoText && !realText && !hasMedia(real) && !hasMedia(echo))
    return false;
  return withinEchoWindow(echo, real);
}

/**
 * One row per Matrix event. A stuck local echo (tilde id, or not yet
 * acknowledged) is dropped once the homeserver copy is in the timeline.
 * Reloading used to hide those copies because a new client has no echo;
 * coming back re-read the same room and showed them again.
 */
export function dedupeTimelineMessages<T extends DedupableTimelineMessage>(
  messages: readonly T[] | null | undefined,
  selfId?: string | null,
): T[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const byId = new Map<string, T>();
  for (const message of messages) {
    const id = message?.id?.trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || richness(message) > richness(existing)) {
      byId.set(id, message);
    }
  }
  const unique = [...byId.values()];
  const acknowledged = unique.filter(
    (message) => !isUnackedEcho(message) && !isPendingSend(message),
  );
  return unique.filter((message) => {
    if (!isUnackedEcho(message) && !isPendingSend(message)) return true;
    return !acknowledged.some(
      (real) =>
        real.id !== message.id &&
        sameAuthor(message, real, selfId) &&
        echoMatchesReal(message, real),
    );
  });
}

/** Session restore must not bring back an in-flight echo on the next visit. */
export function timelineMessagesForPersistence<
  T extends DedupableTimelineMessage,
>(messages: readonly T[] | null | undefined, selfId?: string | null): T[] {
  return dedupeTimelineMessages(messages, selfId).filter((message) => {
    const id = message.id?.trim() ?? '';
    if (!id || id.startsWith('~') || id.startsWith('hypha-send-pending')) {
      return false;
    }
    if (message.sendPending) return false;
    if (message.sendAcknowledged === false) return false;
    return true;
  });
}
