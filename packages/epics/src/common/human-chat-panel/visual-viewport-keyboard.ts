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
