/** Height of the messages frame: the visible column under the menu, above the phone tab bar. */
export function messagesFrameHeight(input: {
  frameTop: number;
  scrollBottom: number;
  viewportBottom: number;
  tabOffset: number;
}): number {
  const visibleBottom = Math.min(input.scrollBottom, input.viewportBottom);
  const next = Math.floor(visibleBottom - input.frameTop - input.tabOffset);
  return Number.isFinite(next) ? Math.max(0, next) : 0;
}

/**
 * Conversation list frame: fill the pinned column so only that list scrolls
 * and Load more can sit at the end of it.
 */
export function messagesListFrameHeight(input: { available: number }): number {
  const available = Number.isFinite(input.available)
    ? Math.max(0, input.available)
    : 0;
  return Math.max(160, available);
}
