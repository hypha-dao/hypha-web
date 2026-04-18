import type { MatrixClient, RoomMember } from 'matrix-js-sdk';

/** Shorten ugly synthetic MXIDs for UI when no display name exists. */
export function shortenMatrixIdForDisplay(mxid: string): string {
  if (!mxid.startsWith('@')) return mxid;
  const rest = mxid.slice(1);
  const colonIdx = rest.indexOf(':');
  if (colonIdx <= 0) return mxid;
  const local = rest.slice(0, colonIdx);
  const domain = rest.slice(colonIdx + 1);
  const looksSynthetic = /privy|_did_/i.test(local) || local.length > 28;
  if (!looksSynthetic) return mxid;
  const shortLocal =
    local.length <= 18 ? local : `${local.slice(0, 10)}…${local.slice(-6)}`;
  return `@${shortLocal}:${domain}`;
}

export function matrixMemberDisplayLabel(
  member: RoomMember,
  fallbackUserId: string,
): string {
  const roomName = member.name?.trim();
  /** SDK often sets `name` to the MXID when no display name exists — treat as absent. */
  if (roomName && roomName !== fallbackUserId) {
    return roomName;
  }
  const profileName = member.user?.displayName?.trim();
  if (profileName && profileName !== fallbackUserId) return profileName;
  const raw = member.rawDisplayName?.trim();
  if (raw && raw !== fallbackUserId) return raw;
  return shortenMatrixIdForDisplay(fallbackUserId);
}

/** Resolve a human-readable label for an MXID using the joined room state (same as timeline headers). */
export function matrixMemberDisplayLabelFromRoom(
  client: MatrixClient | null,
  roomId: string | null | undefined,
  userId: string,
): string {
  if (!userId.trim()) return userId;
  if (!client || !roomId) return shortenMatrixIdForDisplay(userId);
  const member = client.getRoom(roomId)?.getMember(userId);
  if (!member) return shortenMatrixIdForDisplay(userId);
  return matrixMemberDisplayLabel(member, userId);
}
