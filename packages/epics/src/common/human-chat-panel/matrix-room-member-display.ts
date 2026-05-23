import type { MatrixClient, RoomMember } from 'matrix-js-sdk';

/** Matrix often prefixes displaynames with `@` — strip for localpart-style checks. */
function displayNameStem(label: string): string {
  const t = label.trim();
  return t.startsWith('@') ? t.slice(1) : t;
}

/**
 * Bridged Privy / Hypha locals: preview (`prev_privy…`), production (`prod_…`),
 * and generic `prod_*` prefixes used on some homeservers for prod Matrix users.
 *
 * `shortenMatrixIdForDisplay` truncates long localparts with "…", so prefix checks
 * must not require characters after `prod_`/`prev_` that might be ellipsis-truncated.
 */
function stemLooksLikeBridgedPrivyLocalpart(stem: string): boolean {
  const s = stem.trim();
  if (/^prev_privy/i.test(s) || /^prod_privy/i.test(s)) return true;
  /** Production Matrix bridge locals often start with `prod_` (not always `prod_privy`). */
  if (/^prod_/i.test(s)) return true;
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

/**
 * Map bridged Matrix `@prod_privy_did_privy_*:hs` locals to Hypha roster `did:privy:*` subs.
 * Roster lookup by raw localpart fails for production bridge users.
 */
export function matrixUserIdToCanonicalPrivySub(userId: string): string | null {
  const trimmed = userId.trim();
  if (!trimmed.startsWith('@')) return null;
  const colon = trimmed.indexOf(':');
  if (colon <= 1) return null;
  const localpart = trimmed.slice(1, colon).trim();
  if (!localpart) return null;
  if (localpart.startsWith('did:privy:')) return localpart;
  const bridged = localpart.match(/^(?:dev|prev|prod)_privy_did_privy_(.+)$/i);
  if (bridged?.[1]) return `did:privy:${bridged[1]}`;
  return null;
}

/** Shorten ugly synthetic MXIDs for UI when no display name exists. */
export function shortenMatrixIdForDisplay(mxid: string): string {
  if (!mxid.startsWith('@')) return mxid;
  const rest = mxid.slice(1);
  const colonIdx = rest.indexOf(':');
  if (colonIdx <= 0) return mxid;
  const local = rest.slice(0, colonIdx);
  const domain = rest.slice(colonIdx + 1);
  const looksSynthetic =
    /privy|_did_|^prod_|^prev_privy|^prod_privy/i.test(local) ||
    local.length > 28;
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
