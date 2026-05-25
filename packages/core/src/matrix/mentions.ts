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
 * The homeserver segment may itself contain `:` (bridged / Privy-style locals). The
 * capture can still greedily absorb a **sentence punctuation** colon after the server
 * (e.g. `@alice:matrix.org: hello`) — normalize with {@link normalizePlainTextMxidCapture}.
 *
 * Clone with `new RegExp(MATRIX_MXID_IN_PLAIN_TEXT.source, 'g')` before `.exec` loops.
 */
export const MATRIX_MXID_IN_PLAIN_TEXT =
  /@([A-Za-z0-9._=\-/]+:[A-Za-z0-9.\-:\[\]]+(?::\d+)?)/g;

/**
 * Strip a trailing `:` wrongly included in the regex capture when it is **sentence
 * punctuation** before whitespace or clause punctuation — not part of the MXID (e.g.
 * bridged locals or `:port`).
 */
export function normalizePlainTextMxidCaptureFromMatch(
  mid: string,
  plain: string,
  matchStart: number,
  /** Full `@…` match length from `MATRIX_MXID_IN_PLAIN_TEXT.exec` (`m[0].length`). */
  matchLen: number,
): string {
  const after = plain.slice(matchStart + matchLen);
  const punctuationBoundary =
    after.length === 0 || /^\s/.test(after) || /^[.,!?;]/.test(after);
  if (!punctuationBoundary) return mid;

  let out = mid;
  if (out.endsWith(':')) {
    /** `:8448` ends the MXID; do not strip (also covers `@hs:8448:` + sentence `:`). */
    out = out.slice(0, -1);
  }

  // Sentence-ending `.` can be captured as part of the homeserver segment (`.` is valid there).
  while (out.endsWith('.')) {
    const next = out.slice(0, -1);
    if (!next.includes(':')) break;
    if (!isLikelyMatrixUserId(`@${next}`)) break;
    out = next;
  }

  return out;
}

export function isLikelyMatrixUserId(id: string): boolean {
  /** Whole-string MXID only — reject `@alice:matrix.org trailing junk`. */
  return /^@[^\s:]+:[^\s]+$/.test(id.trim());
}

/**
 * Matrix rich-reply `body` often prefixes a `>`-quoted block; `extractMentionUserIdsFromPlainBody`
 * should scan the same visible line as the UI (mirrors `stripMatrixReplyFallback` in rich-reply).
 */
function bodyPlainForMentionExtraction(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('\n\n');
  if (idx === -1) return body;
  const head = normalized.slice(0, idx);
  const headLines = head.split('\n');
  const isQuotedBlock = headLines.every(
    (line) => line.startsWith('>') || line.trim() === '',
  );
  if (!isQuotedBlock) return body;
  return normalized.slice(idx + 2).trimEnd();
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
    const rawMid = m[1] ?? '';
    const mid = normalizePlainTextMxidCaptureFromMatch(
      rawMid,
      plain,
      m.index,
      m[0].length,
    );
    if (!mid) continue;
    const full = `@${mid}`;
    if (!isLikelyMatrixUserId(full)) continue;
    if (seen.has(full)) continue;
    seen.add(full);
    out.push(full);
  }
  return out;
}

/**
 * Replace `@user:homeserver` tokens in plaintext with human labels (TTS, copy, etc.).
 * Uses the same MXID scan as {@link extractMentionUserIdsFromPlainBody}.
 */
export function replacePlainTextMatrixMxidsWithLabels(
  plain: string,
  resolveLabel: (matrixUserId: string) => string,
): string {
  if (!plain.trim()) return plain;
  let out = '';
  let lastIndex = 0;
  const re = new RegExp(MATRIX_MXID_IN_PLAIN_TEXT.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const rawMid = m[1] ?? '';
    const mid = normalizePlainTextMxidCaptureFromMatch(
      rawMid,
      plain,
      m.index,
      m[0].length,
    );
    const full = `@${mid}`;
    if (!isLikelyMatrixUserId(full)) continue;
    out += plain.slice(lastIndex, m.index);
    const label = resolveLabel(full).trim();
    out += label && label !== full ? label : m[0];
    lastIndex = m.index + m[0].length;
  }
  out += plain.slice(lastIndex);
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

/**
 * True when a room message’s wire content @-mentions `userId`: MSC3952
 * `m.mentions.user_ids` **or** an MXID token in `body` (for clients that omit
 * `m.mentions` while the rendered text still contains `@user:server`).
 */
export function contentMentionsMatrixUser(
  content: unknown,
  userId: string,
): boolean {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  const m = parseMentionUserIdsFromWireContent(c);
  if (m?.includes(userId)) return true;
  const body = c.body;
  if (typeof body !== 'string' || !body) return false;
  return extractMentionUserIdsFromPlainBody(
    bodyPlainForMentionExtraction(body),
  ).includes(userId);
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
  const out = [
    ...new Set(
      ids.filter(
        (id): id is string =>
          typeof id === 'string' && isLikelyMatrixUserId(id),
      ),
    ),
  ];
  return out.length > 0 ? out : undefined;
}
