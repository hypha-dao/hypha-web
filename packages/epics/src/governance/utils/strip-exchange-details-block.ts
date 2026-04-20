const EXCHANGE_DETAILS_START = '<!-- exchange-details:start -->';
const EXCHANGE_DETAILS_END = '<!-- exchange-details:end -->';

/**
 * Removes the embedded exchange-details HTML comment block without using
 * catastrophic backtracking (avoids ReDoS on pathological inputs).
 *
 * @param replaceWith - Inserted where each block was removed (document cards use `'\n'`).
 */
export function stripExchangeDetailsBlock(
  description: string,
  options?: { replaceWith?: string },
): string {
  const insert = options?.replaceWith ?? '';
  let cleaned = description;

  while (true) {
    const startIndex = cleaned.indexOf(EXCHANGE_DETAILS_START);
    if (startIndex === -1) break;

    const endIndex = cleaned.indexOf(
      EXCHANGE_DETAILS_END,
      startIndex + EXCHANGE_DETAILS_START.length,
    );
    if (endIndex === -1) break;

    const markerEndIndex = endIndex + EXCHANGE_DETAILS_END.length;
    const sliceStart =
      startIndex > 0 && cleaned[startIndex - 1] === '\n'
        ? startIndex - 1
        : startIndex;
    const sliceEnd =
      markerEndIndex < cleaned.length && cleaned[markerEndIndex] === '\n'
        ? markerEndIndex + 1
        : markerEndIndex;

    cleaned = `${cleaned.slice(0, sliceStart)}${insert}${cleaned.slice(
      sliceEnd,
    )}`;
  }

  return cleaned;
}
