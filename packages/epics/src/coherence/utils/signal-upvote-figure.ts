/**
 * Shared upvote cell. 64px wide so a 16px Manrope semibold tabular
 * "694.3K" (about 54px) stays inside the border. 48px was too narrow.
 */
export const SIGNAL_UPVOTE_CELL_CLASS =
  'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 border px-0.5 tabular-nums transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** Content box after the 1px border and 2px side padding, with 2px spare. */
const CONTENT_PX = 56;
/** Measured Manrope 600 tabular width of one glyph at 16px. */
const GLYPH_PX_AT_16 = 9.05;
const MAX_FIGURE_PX = 16;
const MIN_FIGURE_PX = 8;

/**
 * Font size that keeps `label` on one line inside the cell. The characters
 * do not change — only the size — so a longer locale string still fits.
 */
export function signalUpvoteFigureFontPx(label: string): number {
  const glyphs = Math.max(1, Array.from(label).length);
  const natural = glyphs * GLYPH_PX_AT_16;
  if (natural <= CONTENT_PX) return MAX_FIGURE_PX;
  const scaled = Math.floor((MAX_FIGURE_PX * CONTENT_PX) / natural);
  return Math.max(MIN_FIGURE_PX, Math.min(MAX_FIGURE_PX, scaled));
}
