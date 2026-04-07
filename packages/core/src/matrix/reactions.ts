/**
 * Matrix m.reaction (m.annotation) aggregation for room messages.
 */

import type * as MatrixSdk from 'matrix-js-sdk';
import { EventType, RelationType } from 'matrix-js-sdk';

import type { Message, MessageReaction } from './types';

/**
 * Matrix reaction keys are emoji strings; reject plain text / overly long payloads before send.
 */
export function isValidReactionKey(key: string): boolean {
  if (!key || key.length > 32) return false;
  for (const ch of key) {
    const cp = ch.codePointAt(0)!;
    if (cp < 33 || cp === 127) return false;
  }
  return /[\p{Extended_Pictographic}\uFE0F\u200D]/u.test(key);
}

/**
 * Aggregate distinct senders per emoji key for a room message using the SDK Relations model.
 */
export function aggregateReactionsForTarget(
  room: MatrixSdk.Room,
  targetEventId: string,
  currentUserId: string | null | undefined,
): MessageReaction[] {
  const rel = room.relations.getChildEventsForEvent(
    targetEventId,
    RelationType.Annotation,
    EventType.Reaction,
  );
  if (!rel) {
    return [];
  }

  const sorted = rel.getSortedAnnotationsByKey();
  if (!sorted) {
    return [];
  }

  const out: MessageReaction[] = [];

  for (const [key, eventSet] of sorted) {
    const bestBySender = new Map<string, { id: string; ts: number }>();
    for (const ev of eventSet) {
      if (ev.isRedacted()) continue;
      const sender = ev.getSender();
      if (!sender) continue;
      const id = ev.getId();
      if (!id) continue;
      const ts = ev.getTs();
      const prev = bestBySender.get(sender);
      if (!prev || ts > prev.ts) {
        bestBySender.set(sender, { id, ts });
      }
    }
    const reactorUserIds = [...bestBySender.entries()]
      .sort((a, b) => b[1].ts - a[1].ts)
      .map(([userId]) => userId);
    const count = reactorUserIds.length;
    let currentUserReactionEventId: string | undefined;
    if (currentUserId) {
      currentUserReactionEventId = bestBySender.get(currentUserId)?.id;
    }
    if (count === 0) continue;
    out.push({
      key,
      count,
      includesCurrentUser:
        currentUserId != null && bestBySender.has(currentUserId),
      currentUserReactionEventId,
      reactorUserIds,
    });
  }

  out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return out;
}

/** Attach aggregated reactions to a room message for UI. */
export function attachReactionsToMessage(
  room: MatrixSdk.Room,
  message: Message,
  currentUserId: string | null | undefined,
): Message {
  return {
    ...message,
    reactions: aggregateReactionsForTarget(room, message.id, currentUserId),
  };
}
