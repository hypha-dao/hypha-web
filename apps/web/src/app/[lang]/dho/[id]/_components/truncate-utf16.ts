/**
 * Truncate by Unicode code points so surrogate pairs are not split (unlike
 * `String.prototype.slice` with a character count).
 */
export function truncateByCodePoints(
  text: string,
  maxCodePoints: number,
): string {
  let i = 0;
  let count = 0;
  while (i < text.length && count < maxCodePoints) {
    const code = text.codePointAt(i);
    if (code === undefined) break;
    const charLen = code > 0xffff ? 2 : 1;
    i += charLen;
    count += 1;
  }
  return i >= text.length ? text : `${text.slice(0, i)}…`;
}
