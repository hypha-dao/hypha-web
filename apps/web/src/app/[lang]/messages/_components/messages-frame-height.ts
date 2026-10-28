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
