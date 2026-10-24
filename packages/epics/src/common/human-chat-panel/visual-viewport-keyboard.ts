/**
 * Layout-viewport overlap from the on-screen keyboard (and iOS zoom).
 * `window.innerHeight - visualViewport.height - offsetTop` is the usual inset.
 */

export function visualViewportKeyboardInset(
  layoutInnerHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  if (
    !Number.isFinite(layoutInnerHeight) ||
    !Number.isFinite(visualHeight) ||
    !Number.isFinite(visualOffsetTop)
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.round(layoutInnerHeight - visualHeight - visualOffsetTop),
  );
}
