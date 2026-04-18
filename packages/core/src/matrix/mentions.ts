/**
 * Matrix intentional mentions (MSC3952): `content.m.mentions.user_ids`.
 * @see https://spec.matrix.org/latest/client-server-api/#intentional-mentions
 */

/** Wire field on `m.room.message` content. */
export const MATRIX_MENTIONS_FIELD = 'm.mentions' as const;

/**
 * Match `@localpart:homeserver` Matrix IDs in plaintext (`body`, composer).
 * Export for UI mention pills (must not truncate at the first `:` inside localpart).
 *
 * Clone with `new RegExp(MATRIX_MXID_IN_PLAIN_TEXT.source, 'g')` before `.exec` loops.
 */
export const MATRIX_MXID_IN_PLAIN_TEXT =
  /@([A-Za-z0-9._=\-/]+:[A-Za-z0-9.\-:\[\]]+(?::\d+)?)/g;

export function isLikelyMatrixUserId(id: string): boolean {
  return /^@[^\s:]+:.+/.test(id);
}

/**
 * Deduped `@user:homeserver` IDs found in plaintext (composer or Matrix body).
 */
export function extractMentionUserIdsFromPlainBody(plain: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MATRIX_MXID_IN_PLAIN_TEXT.source, 'g');
  while ((m = re.exec(plain)) !== null) {
    const mid = m[1];
    if (!mid) continue;
    const full = `@${mid}`;
    if (!isLikelyMatrixUserId(full)) continue;
    if (seen.has(full)) continue;
    seen.add(full);
    out.push(full);
  }
  return out;
}

export function mentionsContentFromUserIds(
  userIds: string[],
): Record<string, { user_ids: string[] }> | undefined {
  const unique = [...new Set(userIds.filter(isLikelyMatrixUserId))];
  if (unique.length === 0) return undefined;
  return {
    [MATRIX_MENTIONS_FIELD]: {
      user_ids: unique,
    },
  };
}

/**
 * Adds `m.mentions` when `@mxid` tokens appear in the given plaintext segment.
 */
export function mergeMatrixMentionsFromPlain<T extends object>(
  content: T,
  plainForMentions: string,
): T {
  const extra = mentionsContentFromUserIds(
    extractMentionUserIdsFromPlainBody(plainForMentions),
  );
  if (!extra) return content;
  return { ...content, ...extra } as T;
}

export function mergeMatrixMentionsIntoContent<T extends object>(
  content: T,
  userIds: string[],
): T {
  const extra = mentionsContentFromUserIds(userIds);
  if (!extra) return content;
  return { ...content, ...extra } as T;
}

/**
 * Prefer explicit IDs from the composer; otherwise parse `@mxid` from plaintext.
 */
export function resolveMentionUserIdsForSend(
  plain: string,
  explicitUserIds?: string[],
): string[] {
  if (explicitUserIds?.length) {
    return [...new Set(explicitUserIds.filter(isLikelyMatrixUserId))];
  }
  return extractMentionUserIdsFromPlainBody(plain);
}

/** Read `m.mentions.user_ids` from an `m.room.message` wire content object. */
export function parseMentionUserIdsFromWireContent(
  content: unknown,
): string[] | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const raw = (content as Record<string, unknown>)['m.mentions'];
  if (!raw || typeof raw !== 'object') return undefined;
  const ids = (raw as { user_ids?: unknown }).user_ids;
  if (!Array.isArray(ids)) return undefined;
  const out = ids.filter((id): id is string => typeof id === 'string');
  return out.length > 0 ? out : undefined;
}
