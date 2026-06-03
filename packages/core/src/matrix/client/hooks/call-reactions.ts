import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';

/** WCUX-REACT-1 — room-scoped anchor for in-call m.reaction annotations. */
export const CALL_SESSION_ANCHOR_TYPE = 'io.hypha.call.session_anchor.v1';

/** WCUX-REACT-2 — ephemeral raise-hand notices (last event per user wins). */
export const CALL_RAISE_HAND_NOTICE_TYPE = 'io.hypha.call.raise_hand.v1';
export const CALL_RAISE_HAND_FIELD = 'io.hypha.call.raise_hand';

export const CALL_FLOATING_REACTION_MS = 2_500;
export const CALL_FLOATING_REACTION_MAX_PER_TILE = 3;

export type CallRaisedHandEntry = {
  userId: string;
  raisedAt: number;
};

type AnchorContent = {
  [CALL_SESSION_ANCHOR_TYPE]?: boolean;
  call_session_id?: string;
};

type RaiseHandContent = {
  [CALL_RAISE_HAND_NOTICE_TYPE]?: boolean;
  [CALL_RAISE_HAND_FIELD]?: boolean;
};

export function isCallSessionAnchorEvent(event: MatrixEvent): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  const content = event.getContent() as AnchorContent;
  return content[CALL_SESSION_ANCHOR_TYPE] === true;
}

export function readCallSessionAnchorId(event: MatrixEvent): string | null {
  if (!isCallSessionAnchorEvent(event)) return null;
  const content = event.getContent() as AnchorContent;
  const id = content.call_session_id?.trim();
  return id || null;
}

export function parseCallReactionAnnotation(
  event: MatrixEvent,
  anchorEventId: string,
): { userId: string; key: string } | null {
  if (event.getType() !== EventType.Reaction || event.isRedacted()) return null;
  const relates = event.getWireContent()?.['m.relates_to'] as
    | { rel_type?: string; event_id?: string; key?: string }
    | undefined;
  if (
    relates?.rel_type !== RelationType.Annotation ||
    relates.event_id !== anchorEventId
  ) {
    return null;
  }
  const key = relates.key?.trim();
  const userId = event.getSender()?.trim();
  if (!key || !userId) return null;
  return { userId, key };
}

export function parseCallRaiseHandNotice(event: MatrixEvent): {
  userId: string;
  raised: boolean;
  raisedAt: number;
} | null {
  if (event.getType() !== EventType.RoomMessage || event.isRedacted()) {
    return null;
  }
  const content = event.getContent() as RaiseHandContent;
  if (content[CALL_RAISE_HAND_NOTICE_TYPE] !== true) return null;
  const userId = event.getSender()?.trim();
  if (!userId) return null;
  return {
    userId,
    raised: content[CALL_RAISE_HAND_FIELD] === true,
    raisedAt: event.getTs(),
  };
}

/** Last raise-hand notice per user wins (WCUX-REACT-2). */
export function aggregateCallRaisedHands(
  eventsOldestFirst: MatrixEvent[],
): CallRaisedHandEntry[] {
  const latestByUser = new Map<string, CallRaisedHandEntry>();
  for (const event of eventsOldestFirst) {
    const parsed = parseCallRaiseHandNotice(event);
    if (!parsed) continue;
    if (!parsed.raised) {
      latestByUser.delete(parsed.userId);
      continue;
    }
    latestByUser.set(parsed.userId, {
      userId: parsed.userId,
      raisedAt: parsed.raisedAt,
    });
  }
  return [...latestByUser.values()].sort((a, b) => a.raisedAt - b.raisedAt);
}
