const DIGIT = /^\d$/;

/**
 * Linear-time validation for decimal-ish user input (avoids ReDoS from
 * patterns like `\d*\.?\d*` on unbounded strings).
 */
export function isPlainDecimalAscii(s: string, maxLen = 128): boolean {
  if (s.length > maxLen) return false;
  let dot = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (DIGIT.test(c)) continue;
    if (c === '.' && !dot) {
      dot = true;
      continue;
    }
    return false;
  }
  return true;
}

/** Like `^\d*(?:[.,]\d*)?$` — digits with at most one decimal separator. */
export function isPlainDecimalWithCommaAscii(s: string, maxLen = 128): boolean {
  if (s.length > maxLen) return false;
  let sep = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (DIGIT.test(c)) continue;
    if ((c === '.' || c === ',') && !sep) {
      sep = true;
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Matches `^(?:\d+\.?\d*|\.\d+)$` without backtracking on long digit runs.
 */
export function isCanonicalDecimalAmountAscii(
  s: string,
  maxLen = 128,
): boolean {
  if (s.length === 0 || s.length > maxLen) return false;

  if (s[0] === '.') {
    let j = 1;
    if (j >= s.length || !DIGIT.test(s[j]!)) return false;
    while (j < s.length) {
      if (!DIGIT.test(s[j]!)) return false;
      j++;
    }
    return true;
  }

  let i = 0;
  while (i < s.length && DIGIT.test(s[i]!)) i++;
  if (i === 0) return false;
  if (i === s.length) return true;
  if (s[i] !== '.') return false;
  i++;
  while (i < s.length) {
    if (!DIGIT.test(s[i]!)) return false;
    i++;
  }
  return true;
}
