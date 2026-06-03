/**
 * CSH-SHARE-5 option A — mobile users view remote share; local share controls hidden.
 * CSH-SHARE-6 — stop local share when viewport crosses mobile breakpoint while presenting.
 */
export const CALL_MOBILE_VIEWPORT_MAX_PX = 767;

export function isCallMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${CALL_MOBILE_VIEWPORT_MAX_PX}px)`)
    .matches;
}
