import { ReceiptType, type Room } from 'matrix-js-sdk';

import { isHyphaBotMatrixIdentity } from './matrix-room-member-display';

type RoomMemberLike = {
  userId?: string;
  membership?: string;
  name?: string;
  rawDisplayName?: string;
};

type RoomLike = Pick<Room, 'getEventReadUpTo' | 'hasUserReadEvent'> & {
  getMembers?: () => RoomMemberLike[];
  getJoinedMembers?: () => RoomMemberLike[];
  getReadReceiptForUserId?: (
    userId: string,
    ignoreSynthesized?: boolean,
    receiptType?: ReceiptType,
  ) => { eventId: string } | null;
  compareEventOrdering?: (
    leftEventId: string,
    rightEventId: string,
  ) => number | null;
};

function roomMembers(room: RoomLike): RoomMemberLike[] {
  try {
    const joined = room.getJoinedMembers?.();
    if (joined && joined.length > 0) return joined;
  } catch {
    // Fall through.
  }
  try {
    return room.getMembers?.() ?? [];
  } catch {
    return [];
  }
}

/** Other joined/invited humans in the room (excludes self and Hypha bots). */
export function dmOtherHumanMembers(
  room: RoomLike,
  selfId: string | null | undefined,
): RoomMemberLike[] {
  const me = selfId?.trim();
  if (!me) return [];
  return roomMembers(room).filter((member) => {
    const userId = member.userId?.trim();
    if (!userId || userId === me) return false;
    if (
      member.membership &&
      member.membership !== 'join' &&
      member.membership !== 'invite'
    ) {
      return false;
    }
    return !isHyphaBotMatrixIdentity(
      userId,
      member.name || member.rawDisplayName,
    );
  });
}

/**
 * The other person in a 1:1 DM. Ignores Hypha bots so a bot invite does not
 * look like a group. Null when there is not exactly one human peer.
 */
export function dmPeerMatrixUserId(
  room: RoomLike,
  selfId: string | null | undefined,
): string | null {
  const others = dmOtherHumanMembers(room, selfId);
  if (others.length !== 1) return null;
  return others[0]?.userId?.trim() || null;
}

/**
 * Peer's public `m.read` cursor in this room, if any.
 * Ignores synthesized receipts and private `m.read.private` so a later peer
 * message is not treated as having read earlier own messages.
 */
export function peerReadUpToEventId(
  room: RoomLike,
  peerId: string | null | undefined,
): string | null {
  const id = peerId?.trim();
  if (!id) return null;
  if (typeof room.getReadReceiptForUserId === 'function') {
    try {
      const receipt = room.getReadReceiptForUserId(id, true, ReceiptType.Read);
      return receipt?.eventId ?? null;
    } catch {
      // Fall through to getEventReadUpTo.
    }
  }
  return room.getEventReadUpTo(id, true) ?? null;
}

/**
 * True when the peer's public read receipt has reached this event (or later).
 * Does not use `hasUserReadEvent` — that helper treats a later peer send as read.
 */
export function messageIsReadByPeer(
  room: RoomLike,
  peerId: string | null | undefined,
  eventId: string | null | undefined,
): boolean {
  const peer = peerId?.trim();
  const event = eventId?.trim();
  if (!peer || !event) return false;
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
  /** False while Matrix still holds a local echo / failed send. */
  sendAcknowledged?: boolean;
  eventId?: string | null;
  peerId?: string | null;
  room?: RoomLike | null;
}): OwnMessageReceiptStatus {
  if (input.sendPending) return 'pending';
  if (input.sendAcknowledged === false) return 'pending';
  if (
    input.room &&
    messageIsReadByPeer(input.room, input.peerId, input.eventId)
  ) {
    return 'read';
  }
  return 'sent';
}
