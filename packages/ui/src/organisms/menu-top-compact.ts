/**
 * Pure helpers for MenuTop collision-aware compact mode.
 * Kept separate so the hysteresis / measurement rules can be reasoned about
 * without DOM timing (and to prevent the iPad landscape expand↔collapse loop).
 */

export type CompactHeaderDecisionInput = {
  freeSpacePx: number;
  isCurrentlyCompact: boolean;
  leftPanelExpanded: boolean;
  /** Enter compact when free space falls below this (while expanded). */
  enterBelowPx: number;
  /** Stay compact until free space reaches this (while compact). Must be > enterBelowPx. */
  exitBelowPx: number;
  /** Force compact at mobile CSS breakpoint regardless of measured free space. */
  forceCompactViewport?: boolean;
};

/**
 * Decide compact header mode with hysteresis so sub-pixel / ResizeObserver noise
 * near the threshold cannot flip the chrome every frame.
 */
export function shouldUseCompactHeader({
  freeSpacePx,
  isCurrentlyCompact,
  leftPanelExpanded,
  enterBelowPx,
  exitBelowPx,
  forceCompactViewport = false,
}: CompactHeaderDecisionInput): boolean {
  if (leftPanelExpanded || forceCompactViewport) {
    return true;
  }

  if (isCurrentlyCompact) {
    return freeSpacePx < exitBelowPx;
  }

  return freeSpacePx < enterBelowPx;
}

/**
 * Resolve the desktop action cluster's intrinsic width.
 *
 * When the cluster is taken out of flow (compact), some engines (notably iPad
 * WebKit) report a collapsed scroll/client width if `flex` is dropped. Prefer the
 * last in-flow measurement so compact mode cannot falsely "fit" and reopen.
 */
export function resolveDesktopClusterWidth(params: {
  measuredPx: number;
  isCompact: boolean;
  cachedPx: number;
}): number {
  const measured = Math.max(0, Math.ceil(params.measuredPx));

  if (!params.isCompact && measured > 0) {
    return measured;
  }

  if (params.cachedPx > 0) {
    // Keep the larger of cache vs live so a partial measure cannot shrink us
    // into an expand→collapse loop; live can still grow if nav content widens.
    return Math.max(params.cachedPx, measured);
  }

  return measured;
}
