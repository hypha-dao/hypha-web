/** Height of the messages frame: the visible column under the menu, above the phone tab bar / site footer. */
export function messagesFrameHeight(input: {
  frameTop: number;
  scrollBottom: number;
  viewportBottom: number;
  tabOffset: number;
  /** Desktop site footer — keep it on screen; the lock freezes column scroll. */
  footerOffset?: number;
}): number {
  const visibleBottom = Math.min(input.scrollBottom, input.viewportBottom);
  const chrome = input.tabOffset + Math.max(0, input.footerOffset ?? 0);
  const next = Math.floor(visibleBottom - input.frameTop - chrome);
  return Number.isFinite(next) ? Math.max(0, next) : 0;
}

/**
 * Conversation list frame: at least as tall as the channel menu, and tall
 * enough to fill the visible column so the list can scroll on its own.
 */
export function messagesListFrameHeight(input: {
  available: number;
  leftHeight: number;
}): number {
  const available = Number.isFinite(input.available)
    ? Math.max(0, input.available)
    : 0;
  const leftHeight = Number.isFinite(input.leftHeight)
    ? Math.max(0, input.leftHeight)
    : 0;
  return Math.max(160, available, leftHeight);
}
