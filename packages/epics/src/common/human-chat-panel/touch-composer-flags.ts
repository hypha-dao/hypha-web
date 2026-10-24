/**
 * Touch composer / row chrome from already-read viewport hooks.
 *
 * Call `useIsMobile()` and `usePrefersCoarsePointer()` as separate statements
 * first — `(useIsMobile() ?? false) || usePrefersCoarsePointer()` skips the
 * second hook once mobile hydrates and React throws #311/#310.
 *
 * Width-only `isMobile` must not drive this flag: a narrow desktop+mouse
 * window should keep hover, context menu, and Enter-to-send.
 */
export function touchComposerFromViewportFlags(
  _isMobile: boolean | undefined,
  prefersCoarsePointer: boolean | undefined,
): boolean {
  return prefersCoarsePointer ?? false;
}
