/**
 * Truncate by user-perceived grapheme clusters (Intl.Segmenter) so surrogate
 * pairs and combined marks are not split.
 */
export function truncateByCodePoints(
  text: string,
  maxCodePoints: number,
): string {
  const maxGraphemes = Math.max(0, Math.trunc(maxCodePoints));
  if (maxGraphemes === 0) {
    return text.length === 0 ? text : '…';
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = Array.from(
    segmenter.segment(text),
    ({ segment }) => segment,
  );

  return segments.length <= maxGraphemes
    ? text
    : `${segments.slice(0, maxGraphemes).join('')}…`;
}
