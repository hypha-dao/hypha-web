/**
 * Chronological merge for the human-chat timeline.
 *
 * The live Matrix timeline is painted first (newest /sync events), then
 * scrollback and Room.timeline callbacks deliver older events. Appending those
 * without sorting leaves newest rows above newer ones while the user is
 * scrolled up.
 */

export type TimelineOrderable = {
  id?: string;
  timestamp?: Date | string | number;
};

export function asTimelineDate(value: unknown): Date | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function timestampMs(value: unknown): number | null {
  const date = asTimelineDate(value);
  return date ? date.getTime() : null;
}

function compareIds(left: unknown, right: unknown): number {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

export function compareMessagesChronologically(
  left: TimelineOrderable,
  right: TimelineOrderable,
): number {
  const leftTs = timestampMs(left?.timestamp);
  const rightTs = timestampMs(right?.timestamp);
  if (leftTs == null && rightTs == null) {
    return compareIds(left?.id, right?.id);
  }
  if (leftTs == null) return 1;
  if (rightTs == null) return -1;
  if (leftTs !== rightTs) return leftTs - rightTs;
  return compareIds(left?.id, right?.id);
}

export function sortMessagesChronologically<T extends TimelineOrderable>(
  messages: readonly T[] | null | undefined,
): T[] {
  if (!Array.isArray(messages)) return [];
  try {
    return messages
      .filter((message): message is T => Boolean(message && message.id))
      .slice()
      .sort(compareMessagesChronologically);
  } catch {
    return messages.filter((message): message is T =>
      Boolean(message && message.id),
    );
  }
}

export function upsertTimelineMessages<T extends TimelineOrderable>(
  prev: readonly T[] | null | undefined,
  incoming: readonly T[] | null | undefined,
): T[] {
  const previous = Array.isArray(prev) ? prev : [];
  const nextIncoming = Array.isArray(incoming) ? incoming : [];
  if (nextIncoming.length === 0) {
    return sortMessagesChronologically(previous);
  }
  const byId = new Map<string, T>();
  for (const message of previous) {
    if (message?.id) byId.set(String(message.id), message);
  }
  for (const message of nextIncoming) {
    if (message?.id) byId.set(String(message.id), message);
  }
  return sortMessagesChronologically([...byId.values()]);
}

export function shouldStickChatTimelineToBottom(input: {
  alreadyStuckToBottom: boolean;
  newestMessageIsOwn: boolean;
  isStreaming: boolean;
}): boolean {
  return (
    input.alreadyStuckToBottom || input.newestMessageIsOwn || input.isStreaming
  );
}
