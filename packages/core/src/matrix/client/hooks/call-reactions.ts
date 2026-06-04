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
  /** Matrix `GroupCall.groupCallId` — shared by everyone in the same room call. */
  group_call_id?: string;
};

type RaiseHandContent = {
  [CALL_RAISE_HAND_NOTICE_TYPE]?: boolean;
  [CALL_RAISE_HAND_FIELD]?: boolean;
  /** Matrix `GroupCall.groupCallId` — scopes raise-hand to one in-room call session. */
  group_call_id?: string;
  call_session_id?: string;
};

export function isCallSessionAnchorEvent(event: MatrixEvent): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  const content = event.getContent() as AnchorContent;
  return content[CALL_SESSION_ANCHOR_TYPE] === true;
}

export function isCallRaiseHandNoticeEvent(event: MatrixEvent): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  const content = event.getContent() as RaiseHandContent;
  return content[CALL_RAISE_HAND_NOTICE_TYPE] === true;
}

/** Ephemeral in-call notices that must never appear in the human chat timeline. */
export function isCallEphemeralRoomMessageEvent(event: MatrixEvent): boolean {
  return isCallSessionAnchorEvent(event) || isCallRaiseHandNoticeEvent(event);
}

export function readCallSessionAnchorId(event: MatrixEvent): string | null {
  if (!isCallSessionAnchorEvent(event)) return null;
  const content = event.getContent() as AnchorContent;
  const id = content.call_session_id?.trim();
  return id || null;
}

/** Group call id stored on the anchor (preferred for reaction correlation). */
export function readCallSessionAnchorGroupCallId(
  event: MatrixEvent,
): string | null {
  if (!isCallSessionAnchorEvent(event)) return null;
  const content = event.getContent() as AnchorContent;
  const id = (content.group_call_id ?? content.call_session_id)?.trim();
  return id || null;
}

/**
 * First anchor for `groupCallId` wins so every participant annotates the same event.
 */
export function findCallReactionAnchorEventId(
  eventsOldestFirst: MatrixEvent[],
  groupCallId: string,
): string | null {
  const target = groupCallId.trim();
  if (!target) return null;
  for (const event of eventsOldestFirst) {
    if (readCallSessionAnchorGroupCallId(event) !== target) continue;
    const eventId = event.getId?.()?.trim();
    if (eventId) return eventId;
  }
  return null;
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

export function readCallRaiseHandGroupCallId(
  event: MatrixEvent,
): string | null {
  if (!isCallRaiseHandNoticeEvent(event)) return null;
  const content = event.getContent() as RaiseHandContent;
  const id = (content.group_call_id ?? content.call_session_id)?.trim();
  return id || null;
}

export function parseCallRaiseHandNotice(event: MatrixEvent): {
  userId: string;
  raised: boolean;
  raisedAt: number;
  groupCallId: string | null;
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
    groupCallId: readCallRaiseHandGroupCallId(event),
  };
}

/** True when call reactions UI should follow the space the user is viewing (not another pinned call). */
export function callReactionsApplyToPinnedSpace(
  pinnedCallSpaceSlug: string | null | undefined,
  boundSpaceSlug: string | null | undefined,
): boolean {
  const pinned = pinnedCallSpaceSlug?.trim();
  if (!pinned) return true;
  const bound = boundSpaceSlug?.trim();
  if (!bound) return true;
  return pinned === bound;
}

/** Last raise-hand notice per user wins (WCUX-REACT-2), scoped to one group call. */
export function aggregateCallRaisedHands(
  eventsOldestFirst: MatrixEvent[],
  groupCallId?: string | null,
): CallRaisedHandEntry[] {
  const target = groupCallId?.trim();
  if (!target) return [];
  const latestByUser = new Map<string, CallRaisedHandEntry>();
  for (const event of eventsOldestFirst) {
    const parsed = parseCallRaiseHandNotice(event);
    if (!parsed || parsed.groupCallId !== target) continue;
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

/** Drop raise-hand entries for users no longer in the group call (stale timeline notices). */
export function filterCallRaisedHandsToInCallParticipants(
  entries: CallRaisedHandEntry[],
  inCallUserIds: string[] | null | undefined,
): CallRaisedHandEntry[] {
  if (!inCallUserIds?.length) return entries;
  const inCall = new Set(inCallUserIds);
  return entries.filter((entry) => inCall.has(entry.userId));
}
