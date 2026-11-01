/**
 * How many pixels of the site footer currently cover the bottom of the
 * viewport. Fixed sidebars and the sticky messages list use this so the
 * composer does not paint over "Powered by Hypha".
 */
export function siteFooterViewportOverlap(input: {
  footerTop: number;
  footerHeight: number;
  viewportHeight: number;
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
  // Fully below the fold, or already scrolled past the top of the viewport.
  if (top >= viewport || top + height <= 0) return 0;
  return Math.min(
    Math.max(0, Math.ceil(viewport - top)),
    Math.max(0, Math.ceil(height)),
  );
}

export const SITE_FOOTER_OFFSET_VAR = '--site-footer-offset';
