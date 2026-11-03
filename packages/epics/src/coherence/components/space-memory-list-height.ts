/** Gap under the top menu when the memory list is sticky. */
export const SPACE_MEMORY_LIST_STICKY_GAP_PX = 12;

/**
 * Cap for the memory list so it scrolls inside its frame while the page
 * still moves. Use a viewport budget — never frameTop from a scrolled page,
 * or the list grows without bound as you scroll.
 */
export function spaceMemoryListHeight(input: {
  viewportBottom: number;
  menuOffset: number;
  tabOffset: number;
  stickyGap?: number;
}): number {
  const stickyGap = input.stickyGap ?? SPACE_MEMORY_LIST_STICKY_GAP_PX;
  const next = Math.floor(
    input.viewportBottom - input.menuOffset - input.tabOffset - stickyGap,
  );
  return Number.isFinite(next) ? Math.max(240, next) : 240;
}
