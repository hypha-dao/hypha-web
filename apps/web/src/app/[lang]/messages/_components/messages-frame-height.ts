/** Gap under the top menu when the conversation list is sticky. */
export const MESSAGES_LIST_STICKY_GAP_PX = 12;

/**
 * Visible window height for the list cap.
 * Never add `visualViewport.offsetTop`. After a tab wakes that offset can
 * be non-zero, the list grows past the screen, and the page scrolls the
 * channel menu away — a reload is the only thing that puts it back.
 * A hidden or collapsed window is ignored so the last good height stays.
 */
export function messagesVisibleViewportHeight(input: {
  innerHeight: number;
  visualHeight?: number | null;
  hidden?: boolean;
}): number | null {
  if (input.hidden) return null;
  const inner = input.innerHeight;
  const visual =
    typeof input.visualHeight === 'number' && input.visualHeight > 0
      ? input.visualHeight
      : inner;
  const height = Math.min(inner > 0 ? inner : visual, visual);
  if (!Number.isFinite(height) || height < 240) return null;
  return height;
}

/**
 * Cap for the conversation list so it scrolls inside its frame while the
 * page still moves. Use a viewport budget — never frameTop from a scrolled
 * page, or the list grows without bound as you scroll.
 */
export function messagesListFrameHeight(input: {
  viewportBottom: number;
  menuOffset: number;
  tabOffset: number;
  stickyGap?: number;
}): number {
  const stickyGap = input.stickyGap ?? MESSAGES_LIST_STICKY_GAP_PX;
  const next = Math.floor(
    input.viewportBottom - input.menuOffset - input.tabOffset - stickyGap,
  );
  return Number.isFinite(next) ? Math.max(160, next) : 160;
}
