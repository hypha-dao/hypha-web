import { EMBED_PREFIX, LANDING_SECTION, WL_SECTIONS } from './constants';

/**
 * How a link renders inside a white-label tree. The context is set once by the
 * white-label root layout; the main app has no context (default behaviour).
 *
 * - `embed`: the Space under `/embed/<slug>` on the main host (iframe).
 * - `host`: the Space at the root of a mapped host; the full app is another
 *   origin, so links that leave the Space need its origin.
 */
export type WhiteLabelLinkContext =
  | { mode: 'embed'; spaceSlug: string; lang: string }
  | { mode: 'host'; spaceSlug: string; lang: string; fullAppOrigin: string };

export type LinkDecision =
  /** Stays in the white-label tree: client-side navigation to `href`. */
  | { kind: 'internal'; href: string }
  /** Leaves the Space: open the full app in a new tab. */
  | { kind: 'external'; href: string };

const SERVED_SECTIONS: readonly string[] = WL_SECTIONS;

/** Public URL of a section of the Space: under `/embed`, or at the host root. */
export function sectionHref(
  ctx: WhiteLabelLinkContext,
  section: string,
  search = '',
): string {
  if (ctx.mode === 'host') return `/${ctx.lang}/${section}${search}`;
  return `/${EMBED_PREFIX}/${ctx.spaceSlug}/${ctx.lang}/${section}${search}`;
}

/**
 * Section of the Space a browser pathname shows (the landing section when the
 * path names none). Both modes: `[/<lang>]/<section>`; embed has the
 * `/embed/<slug>` prefix first.
 */
export function sectionFromPathname(
  ctx: WhiteLabelLinkContext,
  pathname: string,
): string {
  const all = pathname.split('/').filter(Boolean);
  const parts = ctx.mode === 'host' ? all : all.slice(2);
  const section = parts[0] === ctx.lang ? parts[1] : parts[0];
  return section ?? LANDING_SECTION;
}

/** Where a link that leaves the Space goes: the full app, not the page's own origin. */
function leaveSpace(ctx: WhiteLabelLinkContext, url: URL): LinkDecision {
  const path = url.pathname + url.search + url.hash;
  // In the iframe the page is on the full app's origin: a relative URL works.
  return {
    kind: 'external',
    href: ctx.mode === 'host' ? ctx.fullAppOrigin + path : path,
  };
}

/**
 * Decides what a link from the main app's component set becomes. The shared
 * components build main-app hrefs (`/<lang>/dho/<slug>/<section>`); this maps
 * the ones that stay in this Space onto the white-label URL space (`/embed`,
 * or the host root) and sends everything else to the full app in a new tab.
 * Only sections the tree serves stay: a link to any other page of the Space
 * (settings, a proposal) would render a dead page. Pure; takes the href as
 * written in the markup. Returns null when the browser should handle the link
 * untouched. `appOrigin` is the origin of the page itself. `locales` are the
 * supported locale codes: on a host, a link in any of them stays in the Space
 * and keeps its own locale.
 */
export function classifyLink(
  rawHref: string,
  ctx: WhiteLabelLinkContext,
  appOrigin: string,
  locales: readonly string[] = [],
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

  if (ctx.mode === 'host') {
    // Host root of this Space: `/`, `/<lang>`, `/<section>`, `/<lang>/<section>`.
    // Anything with more segments is a main-app URL (or not served).
    const first = parts[0];
    const hasLocale =
      first !== undefined && (first === ctx.lang || locales.includes(first));
    const own = hasLocale ? parts.slice(1) : parts;
    // A link keeps the locale it names; without one, the page's own.
    const linkCtx = hasLocale ? { ...ctx, lang: first } : ctx;
    if (own.length === 0) {
      return {
        kind: 'internal',
        href: sectionHref(linkCtx, LANDING_SECTION, url.search),
      };
    }
    const [only] = own;
    if (
      own.length === 1 &&
      only !== undefined &&
      SERVED_SECTIONS.includes(only)
    ) {
      return { kind: 'internal', href: sectionHref(linkCtx, only, url.search) };
    }
  } else if (parts[0] === EMBED_PREFIX && parts[1] === ctx.spaceSlug) {
    // Already a white-label URL of this Space. Another Space's /embed URL would
    // keep this document's frame-ancestors, so it opens in a new tab instead.
    return { kind: 'internal', href: url.pathname + url.search };
  }

  // Main-app Space URL: /<lang>/dho/<slug>/<section>
  if (parts[1] === 'dho' && parts[2] === ctx.spaceSlug) {
    if (parts.length === 3) {
      return {
        kind: 'internal',
        href: sectionHref(ctx, LANDING_SECTION, url.search),
      };
    }
    const section = parts[3];
    if (
      parts.length === 4 &&
      section !== undefined &&
      SERVED_SECTIONS.includes(section)
    ) {
      return {
        kind: 'internal',
        href: sectionHref(ctx, section, url.search),
      };
    }
  }
  return leaveSpace(ctx, url);
}
