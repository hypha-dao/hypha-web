import { EMBED_PREFIX } from './constants';

/**
 * How a link renders inside a white-label tree. The context is set once by the
 * white-label root layout; the main app has no context (default behaviour).
 */
export type WhiteLabelLinkContext = {
  mode: 'embed';
  spaceSlug: string;
  lang: string;
};

export type LinkDecision =
  /** Stays in the white-label tree: client-side navigation to `href`. */
  | { kind: 'internal'; href: string }
  /** Leaves the Space: open the full app in a new tab. */
  | { kind: 'external'; href: string };

/** Public URL (under `/embed`) of a section of the Space. */
export function sectionHref(
  ctx: WhiteLabelLinkContext,
  section: string,
  search = '',
): string {
  return `/${EMBED_PREFIX}/${ctx.spaceSlug}/${ctx.lang}/${section}${search}`;
}

/**
 * Decides what a link from the main app's component set becomes. The shared
 * components build main-app hrefs (`/<lang>/dho/<slug>/<section>`); this maps
 * the ones that stay in this Space onto `/embed` and sends everything else to
 * the full app in a new tab. Pure; takes the href as written in the markup.
 * Returns null when the browser should handle the link untouched.
 */
export function classifyLink(
  rawHref: string,
  ctx: WhiteLabelLinkContext,
  appOrigin: string,
): LinkDecision | null {
  if (!rawHref || rawHref.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(rawHref, appOrigin);
  } catch {
    return null;
  }
  // Non-http(s) (mailto:, tel:, ...) is left to the browser.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // Other sites: open outside the frame.
  if (url.origin !== appOrigin) return { kind: 'external', href: url.href };

  const parts = url.pathname.split('/').filter(Boolean);
  // Already a white-label URL of this Space. Another Space's /embed URL would
  // keep this document's frame-ancestors, so it opens in a new tab instead.
  if (parts[0] === EMBED_PREFIX && parts[1] === ctx.spaceSlug) {
    return { kind: 'internal', href: url.pathname + url.search };
  }
  // Main-app Space URL: /<lang>/dho/<slug>/<section>
  if (parts[1] === 'dho' && parts[2] === ctx.spaceSlug) {
    if (parts.length === 3) {
      return {
        kind: 'internal',
        href: sectionHref(ctx, 'overview', url.search),
      };
    }
    const section = parts[3];
    if (parts.length === 4 && section !== undefined) {
      return {
        kind: 'internal',
        href: sectionHref(ctx, section, url.search),
      };
    }
  }
  return { kind: 'external', href: url.pathname + url.search + url.hash };
}
