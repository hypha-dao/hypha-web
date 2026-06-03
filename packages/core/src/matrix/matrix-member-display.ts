import type { MatrixClient, RoomMember } from 'matrix-js-sdk';

/** Matrix often prefixes displaynames with `@` — strip for localpart-style checks. */
function displayNameStem(label: string): string {
  const t = label.trim();
  return t.startsWith('@') ? t.slice(1) : t;
}

/**
 * Bridged Privy / Hypha locals: preview (`prev_privy…`), production (`prod_…`),
 * and generic `prod_*` prefixes used on some homeservers for prod Matrix users.
 */
function stemLooksLikeBridgedPrivyLocalpart(stem: string): boolean {
  const s = stem.trim();
  if (/^prev_privy/i.test(s) || /^prod_privy/i.test(s)) return true;
  if (/^prod_/i.test(s)) return true;
  return false;
}

/**
 * First label safe to show in UI for a Matrix member.
 * Never returns bridged Privy slugs, raw MXIDs, or synthetic shortened locals.
 */
export function pickUserVisibleMemberLabel(
  matrixUserId: string,
  ...candidates: Array<string | undefined | null>
): string | null {
  const id = matrixUserId.trim();
  if (!id) return null;
  for (const candidate of candidates) {
    const label = candidate?.trim();
    if (!label) continue;
    if (!looksLikeTechnicalMatrixDisplayName(label, id)) return label;
  }
  return null;
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
 * Timeline header: trigger Hypha profile resolution when the Matrix-derived label still
 * looks like a bridged Privy slug (often `@prev_privy_…` or MXID).
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

/** Resolve Hypha `did:privy:*` from a transcript speaker label (MXID or bare localpart). */
export function speakerLabelToCanonicalPrivySub(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('@')) return matrixUserIdToCanonicalPrivySub(trimmed);
  if (trimmed.startsWith('did:privy:')) return trimmed;
  const bridged = trimmed.match(/^(?:dev|prev|prod)_privy_did_privy_(.+)$/i);
  if (bridged?.[1]) return `did:privy:${bridged[1]}`;
  return null;
}

/**
 * Split a speaker-labeled transcript line (`speaker: body`).
 * When the speaker is a full Matrix id (`@local:domain: body`), split after the MXID,
 * not on the first colon inside the localpart/domain.
 */
export function splitSpeakerLabeledTranscriptLine(
  line: string,
): { speaker: string; body: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('@')) {
    const domainColon = trimmed.indexOf(':', 1);
    if (domainColon > 1) {
      const bodyColon = trimmed.indexOf(':', domainColon + 1);
      if (bodyColon > domainColon) {
        const speaker = trimmed.slice(0, bodyColon).trim();
        const body = trimmed.slice(bodyColon + 1);
        if (speaker && body.trim()) {
          return { speaker, body };
        }
      }
    }
  }
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx <= 0) return null;
  const speaker = trimmed.slice(0, colonIdx).trim();
  const body = trimmed.slice(colonIdx + 1);
  if (!speaker || !body.trim()) return null;
  return { speaker, body };
}

/** True when a call-transcript speaker prefix still looks like a bridged Privy slug. */
export function looksLikeTechnicalSpeakerLabel(label: string): boolean {
  const l = label.trim();
  if (!l) return false;
  if (l.startsWith('@')) {
    return needsHyphaProfileResolutionForMatrixLabel(l);
  }
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

/** Resolve a human-readable label for an MXID using joined room state. */
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
