import type { Room } from 'matrix-js-sdk';

type RoomMemberLike = {
  userId?: string;
  membership?: string;
};

type RoomLike = Pick<Room, 'getEventReadUpTo' | 'hasUserReadEvent'> & {
  getMembers?: () => RoomMemberLike[];
  compareEventOrdering?: (
    leftEventId: string,
    rightEventId: string,
  ) => number | null;
};

/**
 * The other person in a 1:1 DM. Null when the room is not a single peer
 * (group chat) or the peer MXID is missing.
 */
export function dmPeerMatrixUserId(
  room: RoomLike,
  selfId: string | null | undefined,
): string | null {
  const me = selfId?.trim();
  if (!me) return null;
  const others = (room.getMembers?.() ?? []).filter((member) => {
    const userId = member.userId?.trim();
    if (!userId || userId === me) return false;
    return member.membership === 'join' || member.membership === 'invite';
  });
  if (others.length !== 1) return null;
  return others[0]?.userId?.trim() || null;
}

/** Peer's public `m.read` cursor in this room, if any. */
export function peerReadUpToEventId(
  room: RoomLike,
  peerId: string | null | undefined,
): string | null {
  const id = peerId?.trim();
  if (!id) return null;
  return room.getEventReadUpTo(id, false) ?? null;
}

/**
 * True when the peer's read receipt has reached this event (or something after).
 * Uses Matrix `hasUserReadEvent` when available; otherwise compares cursors.
 */
export function messageIsReadByPeer(
  room: RoomLike,
  peerId: string | null | undefined,
  eventId: string | null | undefined,
): boolean {
  const peer = peerId?.trim();
  const event = eventId?.trim();
  if (!peer || !event) return false;
  if (typeof room.hasUserReadEvent === 'function') {
    try {
      return room.hasUserReadEvent(peer, event);
    } catch {
      // Fall through to ordering when the SDK throws on unknown ids.
    }
  }
  const readUpTo = peerReadUpToEventId(room, peer);
  if (!readUpTo) return false;
  if (readUpTo === event) return true;
  if (typeof room.compareEventOrdering !== 'function') return false;
  const cmp = room.compareEventOrdering(readUpTo, event);
  return cmp != null && cmp >= 0;
}

export type OwnMessageReceiptStatus = 'pending' | 'sent' | 'read';

/** Status for the current user's own DM message. */
export function ownMessageReceiptStatus(input: {
  sendPending?: boolean;
  eventId?: string | null;
  peerId?: string | null;
  room?: RoomLike | null;
}): OwnMessageReceiptStatus {
  if (input.sendPending) return 'pending';
  if (
    input.room &&
    messageIsReadByPeer(input.room, input.peerId, input.eventId)
  ) {
    return 'read';
  }
  return 'sent';
}
