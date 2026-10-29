/**
 * Height of the memory list: the visible column under the filters.
 * The page stays put, so this must not grow when the column scrolls.
 * The site footer stays below the fold — do not reserve it here.
 */
export function spaceMemoryListHeight(input: {
  frameTop: number;
  scrollBottom: number;
  viewportBottom: number;
  tabOffset: number;
}): number {
  const visibleBottom = Math.min(input.scrollBottom, input.viewportBottom);
  const next = Math.floor(visibleBottom - input.frameTop - input.tabOffset);
  return Number.isFinite(next) ? Math.max(240, next) : 240;
}
