/**
 * Ignore hairline peeks (e.g. the messages sticky-list gap). Lifting fixed
 * sidebars for those peeks left a white strip under the composer without the
 * footer being meaningfully on screen.
 */
export const SITE_FOOTER_OVERLAP_IGNORE_BELOW_PX = 24;

/**
 * How many pixels of the site footer currently cover the bottom of the
 * viewport. Fixed sidebars use this so the composer does not paint over
 * "Powered by Hypha" when the footer is actually on screen.
 */
export function siteFooterViewportOverlap(input: {
  footerTop: number;
  footerHeight: number;
  viewportHeight: number;
  ignoreBelowPx?: number;
}): number {
  const height = input.footerHeight;
  const viewport = input.viewportHeight;
  if (
    !Number.isFinite(height) ||
    !Number.isFinite(viewport) ||
    height <= 0 ||
    viewport <= 0
  ) {
    return 0;
  }
  const top = input.footerTop;
  if (!Number.isFinite(top)) return 0;
  // Intersection of [footerTop, footerTop+height] with [0, viewport].
  const visibleTop = Math.max(0, top);
  const visibleBottom = Math.min(viewport, top + height);
  const overlap = Math.max(0, Math.ceil(visibleBottom - visibleTop));
  if (overlap <= 0) return 0;
  const ignoreBelow =
    typeof input.ignoreBelowPx === 'number' &&
    Number.isFinite(input.ignoreBelowPx)
      ? Math.max(0, input.ignoreBelowPx)
      : SITE_FOOTER_OVERLAP_IGNORE_BELOW_PX;
  return overlap < ignoreBelow ? 0 : overlap;
}

export const SITE_FOOTER_OFFSET_VAR = '--site-footer-offset';
