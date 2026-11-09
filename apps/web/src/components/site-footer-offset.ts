/**
 * Ignore hairline peeks (e.g. the messages sticky-list gap). Lifting fixed
 * sidebars for those peeks left a white strip under the composer without the
 * footer being meaningfully on screen.
 */
export const SITE_FOOTER_OVERLAP_IGNORE_BELOW_PX = 24;

/** Slack for sub-pixel / rubber-band scroll end detection. */
export const SITE_FOOTER_SCROLL_END_SLACK_PX = 4;

/**
 * True when the scroll root cannot scroll further (or content fits the
 * viewport). The site footer only pins/shows in that state.
 */
export function isScrollRootAtEnd(input: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  slackPx?: number;
}): boolean {
  const top = input.scrollTop;
  const view = input.clientHeight;
  const height = input.scrollHeight;
  if (
    !Number.isFinite(top) ||
    !Number.isFinite(view) ||
    !Number.isFinite(height) ||
    view <= 0 ||
    height <= 0
  ) {
    return false;
  }
  const slack =
    typeof input.slackPx === 'number' && Number.isFinite(input.slackPx)
      ? Math.max(0, input.slackPx)
      : SITE_FOOTER_SCROLL_END_SLACK_PX;
  // Content fits: already "fully scrolled".
  if (height <= view + slack) return true;
  return top + view >= height - slack;
}

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
