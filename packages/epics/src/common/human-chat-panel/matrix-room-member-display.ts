import type { MatrixClient, RoomMember } from 'matrix-js-sdk';

/** Matrix often prefixes displaynames with `@` — strip for localpart-style checks. */
function displayNameStem(label: string): string {
  const t = label.trim();
  return t.startsWith('@') ? t.slice(1) : t;
}

/**
 * `shortenMatrixIdForDisplay` truncates long localparts with "…" (e.g. `prev_privy…abc123`),
 * so we must not require the underscore after `privy_` — only the prefix.
 */
function stemLooksLikeBridgedPrivyLocalpart(stem: string): boolean {
  if (/^prev_privy/i.test(stem) || /^prod_privy/i.test(stem)) return true;
  return false;
}

/** Matrix `m.room.member` displayname can mirror the ugly localpart — treat as absent. */
export function looksLikeTechnicalMatrixDisplayName(
  label: string | undefined,
  matrixUserId: string,
): boolean {
  const l = label?.trim() ?? '';
  if (!l || l === matrixUserId) return true;
  const stem = displayNameStem(l);
  if (stemLooksLikeBridgedPrivyLocalpart(stem)) return true;
  if (/privy_did_privy/i.test(l)) return true;
  return false;
}

/**
 * Timeline header: trigger Hypha profile resolution (`matrix_user_links` → Person) when the
 * Matrix-derived label still looks like a bridged Privy slug (often `@prev_privy_…` or MXID).
 */
export function needsHyphaProfileResolutionForMatrixLabel(
  label: string | undefined,
): boolean {
  const l = label?.trim() ?? '';
  if (!l) return true;
  const stem = displayNameStem(l);
  if (stemLooksLikeBridgedPrivyLocalpart(stem)) return true;
  if (/privy_did_privy/i.test(l)) return true;
  return false;
}

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
  /** SDK often sets `name` to the MXID when no display name exists — still run technical check. */
  if (
    roomName &&
    !looksLikeTechnicalMatrixDisplayName(roomName, fallbackUserId)
  ) {
    return roomName;
  }
  const profileName = member.user?.displayName?.trim();
  if (
    profileName &&
    !looksLikeTechnicalMatrixDisplayName(profileName, fallbackUserId)
  ) {
    return profileName;
  }
  const raw = member.rawDisplayName?.trim();
  if (raw && !looksLikeTechnicalMatrixDisplayName(raw, fallbackUserId)) {
    return raw;
  }
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
