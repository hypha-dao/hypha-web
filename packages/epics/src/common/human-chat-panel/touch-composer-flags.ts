/**
 * Combine already-read viewport hooks. Never write
 * `(useIsMobile() ?? false) || usePrefersCoarsePointer()` — `||` skips the
 * second hook once the first is true (mobile hydrate) and React throws #311/#310.
 */
export function touchComposerFromViewportFlags(
  isMobile: boolean | undefined,
  prefersCoarsePointer: boolean | undefined,
): boolean {
  return (isMobile ?? false) || (prefersCoarsePointer ?? false);
}
