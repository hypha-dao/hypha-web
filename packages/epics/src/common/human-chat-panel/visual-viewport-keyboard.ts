/**
 * Layout-viewport overlap from the on-screen keyboard (and iOS zoom).
 * `window.innerHeight - visualViewport.height - offsetTop` is the usual inset.
 *
 * Applying that inset as padding while the mobile chat sheet is opening can
 * change visualViewport again and loop (`Maximum update depth exceeded`).
 * Only treat a large, focused-composer overlap as a keyboard, and ignore
 * small jitter once an inset is already applied.
 */

const KEYBOARD_INSET_MIN_PX = 120;
const INSET_JITTER_PX = 24;

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

export function effectiveComposerKeyboardInset(
  rawInset: number,
  composerFocused: boolean,
): number {
  if (!composerFocused) return 0;
  if (!Number.isFinite(rawInset) || rawInset < KEYBOARD_INSET_MIN_PX) {
    return 0;
  }
  return Math.round(rawInset);
}

/**
 * Base spacing plus the larger of the keyboard inset and the iOS home-indicator
 * inset. Summing them stacks extra gap when the keyboard is already open.
 */
export function composerBottomPadding(keyboardInset: number): string {
  const inset =
    Number.isFinite(keyboardInset) && keyboardInset > 0 ? keyboardInset : 0;
  return `calc(0.5rem + max(${inset}px, env(safe-area-inset-bottom, 0px)))`;
}

/** Keep padding stable so a layout→visualViewport feedback loop cannot setState. */
export function stabilizeComposerKeyboardInset(
  current: number,
  next: number,
): number {
  if (!Number.isFinite(next) || next <= 0) return 0;
  if (!Number.isFinite(current) || current <= 0) return next;
  if (Math.abs(current - next) < INSET_JITTER_PX) return current;
  return next;
}
