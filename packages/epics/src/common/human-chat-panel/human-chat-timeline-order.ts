/**
 * Chronological merge for the human-chat timeline.
 *
 * The live Matrix timeline is painted first (newest /sync events), then
 * scrollback and Room.timeline callbacks deliver older events. Appending those
 * without sorting leaves newest rows above older ones while the user is
 * scrolled up.
 */

export type TimelineOrderable = {
  id: string;
  timestamp?: Date;
};

function timestampMs(value: Date | undefined): number | null {
  if (!value) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function compareMessagesChronologically(
  left: TimelineOrderable,
  right: TimelineOrderable,
): number {
  const leftTs = timestampMs(left.timestamp);
  const rightTs = timestampMs(right.timestamp);
  if (leftTs == null && rightTs == null) {
    return left.id.localeCompare(right.id);
  }
  if (leftTs == null) return 1;
  if (rightTs == null) return -1;
  if (leftTs !== rightTs) return leftTs - rightTs;
  return left.id.localeCompare(right.id);
}

export function sortMessagesChronologically<T extends TimelineOrderable>(
  messages: readonly T[],
): T[] {
  return [...messages].sort(compareMessagesChronologically);
}

export function upsertTimelineMessages<T extends TimelineOrderable>(
  prev: readonly T[],
  incoming: readonly T[],
): T[] {
  if (incoming.length === 0) return prev as T[];
  const byId = new Map<string, T>();
  for (const message of prev) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort(compareMessagesChronologically);
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
