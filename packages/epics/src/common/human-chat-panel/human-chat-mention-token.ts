/**
 * Parse an active `@query` fragment before the cursor for mention autocomplete.
 */

import { MENTION_DISPLAY_ZWSP } from './human-chat-display-mention';

export type ActiveAtToken = {
  /** Index of `@` in `value`. */
  start: number;
  /** Text after `@` up to (but not including) the cursor — used to filter members. */
  query: string;
};

const MAX_QUERY_LEN = 256;

function isAtWordStart(value: string, atIndex: number): boolean {
  if (atIndex <= 0) return true;
  const prev = value.charAt(atIndex - 1);
  /** Open `@` after any non–word-constituent (whitespace, punctuation, `(` before backtick-mxids, etc.). */
  return !/[\p{L}\p{M}\p{N}_]/u.test(prev);
}

/**
 * Returns the `@…` segment when the caret is immediately after `@` or inside the query,
 * Matrix-style (`@localpart`, `@user:homeserver`). Closes once whitespace is typed after `@`.
 */
export function getActiveAtToken(
  value: string,
  cursor: number,
): ActiveAtToken | null {
  const before = value.slice(0, cursor);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) return null;
  if (!isAtWordStart(value, atIdx)) return null;

  const afterAt = before.slice(atIdx + 1);
  /** Composer tokens are `@` + ZWSP + display name — strip ZWSP for query matching. */
  const afterForQuery = afterAt.startsWith(MENTION_DISPLAY_ZWSP)
    ? afterAt.slice(MENTION_DISPLAY_ZWSP.length)
    : afterAt;
  if (afterForQuery.includes('\n')) return null;
  if (/\s/.test(afterForQuery)) return null;

  const query = afterForQuery.slice(0, MAX_QUERY_LEN);
  /** Unicode letters / marks / numbers — `\w` is ASCII-only and rejects José, Zoë, etc. */
  if (!/^[\p{L}\p{M}\p{N}_.=\-/:']*$/u.test(query)) return null;

  return { start: atIdx, query };
}
