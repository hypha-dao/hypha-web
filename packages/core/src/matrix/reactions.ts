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
    const senders = new Set<string>();
    const reactorUserIds: string[] = [];
    let currentUserReactionEventId: string | undefined;
    for (const ev of eventSet) {
      if (ev.isRedacted()) continue;
      const sender = ev.getSender();
      if (!sender || senders.has(sender)) continue;
      senders.add(sender);
      reactorUserIds.push(sender);
      if (currentUserId && sender === currentUserId) {
        const id = ev.getId();
        if (id) currentUserReactionEventId = id;
      }
    }
    const count = senders.size;
    if (count === 0) continue;
    out.push({
      key,
      count,
      includesCurrentUser: currentUserId != null && senders.has(currentUserId),
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
