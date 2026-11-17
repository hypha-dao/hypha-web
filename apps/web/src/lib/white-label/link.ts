import { EMBED_PREFIX, WL_CLIENT_PARAM, WL_SECTIONS } from './constants';
import { isTabVisible, landingTab } from './tabs';
import type {
  CreateAction,
  DetailView,
  Tab,
  UnsupportedActions,
} from './types';

/**
 * How a link renders inside a white-label tree. The context is set once by the
 * white-label root layout; the main app has no context (default behaviour).
 *
 * - `embed`: the Space under `/embed/<slug>` on the main host (iframe).
 * - `host`: the Space at the root of a mapped host; the full app is another
 *   origin, so links that leave the Space need its origin.
 */
export type WhiteLabelLinkContext =
  | {
      mode: 'embed';
      spaceSlug: string;
      lang: string;
      /** The client selected for this frame; carried on every link that stays in it. */
      clientId?: string;
      detailView?: DetailView;
      /** Absent means `hide`: create-flow links do nothing. */
      unsupportedActions?: UnsupportedActions;
      /** Create flows served here; absent means none. */
      createActions?: readonly CreateAction[];
      /** Tabs shown, in the bar's order; absent means all (see `isTabVisible`). */
      tabs?: readonly Tab[];
    }
  | {
      mode: 'host';
      spaceSlug: string;
      lang: string;
      fullAppOrigin: string;
      detailView?: DetailView;
      unsupportedActions?: UnsupportedActions;
      createActions?: readonly CreateAction[];
      /** Tabs shown, in the bar's order; absent means all (see `isTabVisible`). */
      tabs?: readonly Tab[];
    };

export type LinkDecision =
  /** Stays in the white-label tree: client-side navigation to `href`. */
  | { kind: 'internal'; href: string }
  /** Leaves the Space: open the full app in a new tab. */
  | { kind: 'external'; href: string }
  /** A create flow the delivery cannot perform, with `unsupportedActions: 'hide'`: the click does nothing. */
  | { kind: 'blocked' };

/**
 * Query string of a link that stays in the frame: the selected client rides
 * along (replacing any `client` the link had), so a later page load keeps the
 * same client's settings. Unchanged on a host and when no client is selected.
 */
export function withClient(ctx: WhiteLabelLinkContext, search: string): string {
  if (ctx.mode !== 'embed' || !ctx.clientId) return search;
  const params = new URLSearchParams(search);
  params.set(WL_CLIENT_PARAM, ctx.clientId);
  return `?${params.toString()}`;
}

const SERVED_SECTIONS: readonly string[] = WL_SECTIONS;

/**
 * Where an "Overview" link goes: overview when the client shows it, else the
 * landing (the first tab it lists).
 */
function overviewTarget(ctx: WhiteLabelLinkContext): string {
  return isTabVisible(ctx.tabs, 'overview') ? 'overview' : landingTab(ctx.tabs);
}

/**
 * A link under a tab the client does not show (`own` = segments after the
 * locale): the bare Overview link goes to the landing, anything else is inert
 * (`blocked`), also under `unsupportedActions: 'full-app'`: hiding a tab is the
 * client's choice for its pages, and an exit to the full app would show what
 * it hid. `null` when the link is not under a hidden tab.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function hiddenTabLink(
  ctx: WhiteLabelLinkContext,
  own: readonly string[],
): 'landing' | 'blocked' | null {
  // The path is raw here; the resolver compares decoded segments, so do the same.
  const first = own[0] === undefined ? undefined : decodeSegment(own[0]);
  if (
    first === undefined ||
    !SERVED_SECTIONS.includes(first) ||
    isTabVisible(ctx.tabs, first)
  ) {
    return null;
  }
  return first === 'overview' && own.length === 1 ? 'landing' : 'blocked';
}

/**
 * Detail pages the tree serves, as segments after the locale (`:` matches one
 * segment). Add an entry only when its page exists under `(wl)`. A link to one
 * stays on the host (or in the frame) when the client's `detailView` is
 * `embedded` (the default); with `full-app` it leaves like any other page.
 */
export const WL_SERVED_DETAIL_PATTERNS: readonly (readonly string[])[] = [
  ['agreements', 'proposal', ':'],
  ['agreements', 'proposal', ':', 'voters'],
  ['coherence', 'signal', ':'],
  ['pipeline', 'track', ':'],
];

function isServedDetail(
  ctx: WhiteLabelLinkContext,
  own: readonly string[],
): boolean {
  if ((ctx.detailView ?? 'embedded') !== 'embedded') return false;
  return WL_SERVED_DETAIL_PATTERNS.some(
    (pattern) =>
      pattern.length === own.length &&
      pattern.every((part, i) => part === ':' || part === own[i]),
  );
}

/** URL of a served detail page (segments as they appear in the pathname). */
function detailHref(
  ctx: WhiteLabelLinkContext,
  own: readonly string[],
  search: string,
): string {
  const path = own.join('/');
  return ctx.mode === 'host'
    ? `/${ctx.lang}/${path}${search}`
    : `/${EMBED_PREFIX}/${ctx.spaceSlug}/${ctx.lang}/${path}${withClient(
        ctx,
        search,
      )}`;
}

/**
 * Main-app URL of a page of this Space, for a link that is shaped like a
 * white-label URL but is not served here (a relative link such as
 * `<pathname>/voters`): `/<lang>/dho/<slug>/<segments>`. Without this the
 * full app would get a path it does not have (a 404).
 */
function mainAppPageOf(
  ctx: WhiteLabelLinkContext,
  lang: string,
  own: readonly string[],
  url: URL,
): LinkDecision {
  return leaveSpace(ctx, url, `/${lang}/dho/${ctx.spaceSlug}/${own.join('/')}`);
}

/**
 * Segments (the one after the section name) that mark a create flow: New
 * proposal (`agreements/select-create-action`, `agreements/create/...`,
 * `treasury/create/...`), New signal, New memory, calendar new and edit. Only
 * that position is read, so a proposal or signal slug that happens to look
 * like one is not a create flow.
 */
const CREATE_FLOW_SEGMENTS: readonly string[] = [
  'create',
  'select-create-action',
  'new-signal',
  'new-memory',
  'new-scheduled-item',
  'edit-scheduled-item',
];

/**
 * The create pages the tree serves when the client enabled them, as segments
 * after the locale, with the `createActions` values that serve each (any of).
 * Every other create path stays a blocked (or full-app) create flow.
 */
const WL_SERVED_CREATE: readonly {
  path: readonly string[];
  needs: readonly CreateAction[];
}[] = [
  { path: ['coherence', 'new-signal'], needs: ['signal'] },
  {
    path: ['agreements', 'select-create-action'],
    needs: ['agreement', 'contribution'],
  },
  { path: ['agreements', 'create'], needs: ['agreement'] },
  {
    path: ['agreements', 'create', 'propose-contribution'],
    needs: ['contribution'],
  },
];

function isServedCreate(
  ctx: WhiteLabelLinkContext,
  own: readonly string[],
): boolean {
  const enabled = ctx.createActions ?? [];
  return WL_SERVED_CREATE.some(
    (page) =>
      page.path.length === own.length &&
      page.path.every((part, i) => part === own[i]) &&
      page.needs.some((need) => enabled.includes(need)),
  );
}

/** `own` = the segments after the locale (and the Space, in the main-app shape). */
export function isCreateFlow(own: readonly string[]): boolean {
  // A main-app URL (`dho/<slug>/...`): the second segment is the Space slug,
  // which may look like a marker. The main-app branch reads it past the slug.
  if (own[0] === 'dho') return false;
  const marker = own[1];
  return marker !== undefined && CREATE_FLOW_SEGMENTS.includes(marker);
}

/**
 * A create-flow link: nothing happens by default (`hide`); with `full-app` it
 * leaves to the same page of the full app. `mainShape` is true when the href
 * is already a main-app URL.
 */
function createFlowDecision(
  ctx: WhiteLabelLinkContext,
  lang: string,
  own: readonly string[],
  url: URL,
  mainShape: boolean,
): LinkDecision {
  if (ctx.unsupportedActions !== 'full-app') return { kind: 'blocked' };
  return mainShape ? leaveSpace(ctx, url) : mainAppPageOf(ctx, lang, own, url);
}

/** Public URL of a section of the Space: under `/embed`, or at the host root. */
export function sectionHref(
  ctx: WhiteLabelLinkContext,
  section: string,
  search = '',
): string {
  if (ctx.mode === 'host') return `/${ctx.lang}/${section}${search}`;
  return `/${EMBED_PREFIX}/${ctx.spaceSlug}/${ctx.lang}/${section}${withClient(
    ctx,
    search,
  )}`;
}

/**
 * Section of the Space a browser pathname shows (the landing tab, the first
 * the client lists, when the path names none). Both modes: `[/<lang>]/<section>`; embed has the
 * `/embed/<slug>` prefix first.
 */
export function sectionFromPathname(
  ctx: WhiteLabelLinkContext,
  pathname: string,
): string {
  return sectionSegment(ctx, pathname) ?? landingTab(ctx.tabs);
}

/** The section named by a browser pathname, `undefined` on the bare path (the landing). */
export function sectionSegment(
  ctx: WhiteLabelLinkContext,
  pathname: string,
): string | undefined {
  const all = pathname.split('/').filter(Boolean);
  const parts = ctx.mode === 'host' ? all : all.slice(2);
  return parts[0] === ctx.lang ? parts[1] : parts[0];
}

/** Where a link that leaves the Space goes: the full app, not the page's own origin. */
function leaveSpace(
  ctx: WhiteLabelLinkContext,
  url: URL,
  pathname = url.pathname,
): LinkDecision {
  const path = pathname + url.search + url.hash;
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
        href: sectionHref(linkCtx, landingTab(ctx.tabs), url.search),
      };
    }
    const hiddenHere = hiddenTabLink(ctx, own);
    if (hiddenHere === 'blocked') return { kind: 'blocked' };
    if (hiddenHere === 'landing') {
      return {
        kind: 'internal',
        href: sectionHref(linkCtx, landingTab(ctx.tabs), url.search),
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
    if (isServedDetail(ctx, own)) {
      return { kind: 'internal', href: detailHref(linkCtx, own, url.search) };
    }
    if (isServedCreate(ctx, own)) {
      return { kind: 'internal', href: detailHref(linkCtx, own, url.search) };
    }
    if (isCreateFlow(own)) {
      return createFlowDecision(ctx, linkCtx.lang, own, url, false);
    }
    // Shaped like a page of this tree (`/<lang>/<section>/...`) but not served:
    // the full app has it under `/dho/<slug>`.
    if (only !== undefined && SERVED_SECTIONS.includes(only)) {
      return mainAppPageOf(ctx, linkCtx.lang, own, url);
    }
  } else if (parts[0] === EMBED_PREFIX && parts[1] === ctx.spaceSlug) {
    // A white-label URL of this Space. Another Space's /embed URL would keep
    // this document's frame-ancestors, so it opens in a new tab instead.
    const afterSlug = parts.slice(2);
    const first = afterSlug[0];
    const hasLocale =
      first !== undefined && (first === ctx.lang || locales.includes(first));
    const own = hasLocale ? afterSlug.slice(1) : afterSlug;
    const lang = hasLocale && first !== undefined ? first : ctx.lang;
    const hiddenHere = hiddenTabLink(ctx, own);
    if (hiddenHere === 'blocked') return { kind: 'blocked' };
    if (hiddenHere === 'landing') {
      return {
        kind: 'internal',
        href: sectionHref({ ...ctx, lang }, landingTab(ctx.tabs), url.search),
      };
    }
    const [section] = own;
    if (
      own.length === 0 ||
      (own.length === 1 &&
        section !== undefined &&
        SERVED_SECTIONS.includes(section)) ||
      isServedDetail(ctx, own)
    ) {
      return {
        kind: 'internal',
        href: url.pathname + withClient(ctx, url.search),
      };
    }
    if (isServedCreate(ctx, own)) {
      return {
        kind: 'internal',
        href: url.pathname + withClient(ctx, url.search),
      };
    }
    if (isCreateFlow(own)) {
      return createFlowDecision(ctx, lang, own, url, false);
    }
    return mainAppPageOf(ctx, lang, own, url);
  }

  // Main-app Space URL: /<lang>/dho/<slug>/<section>
  if (parts[1] === 'dho' && parts[2] === ctx.spaceSlug) {
    if (parts.length === 3) {
      return {
        kind: 'internal',
        href: sectionHref(ctx, overviewTarget(ctx), url.search),
      };
    }
    const hiddenHere = hiddenTabLink(ctx, parts.slice(3));
    if (hiddenHere === 'blocked') return { kind: 'blocked' };
    if (hiddenHere === 'landing') {
      return {
        kind: 'internal',
        href: sectionHref(ctx, landingTab(ctx.tabs), url.search),
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
    if (isServedDetail(ctx, parts.slice(3))) {
      return {
        kind: 'internal',
        // Keep the locale the link names (as the host-shaped branch does).
        href: detailHref(
          parts[0] !== undefined && locales.includes(parts[0])
            ? { ...ctx, lang: parts[0] }
            : ctx,
          parts.slice(3),
          url.search,
        ),
      };
    }
    if (isServedCreate(ctx, parts.slice(3))) {
      return {
        kind: 'internal',
        href: detailHref(
          parts[0] !== undefined && locales.includes(parts[0])
            ? { ...ctx, lang: parts[0] }
            : ctx,
          parts.slice(3),
          url.search,
        ),
      };
    }
    if (isCreateFlow(parts.slice(3))) {
      return createFlowDecision(ctx, parts[0] ?? ctx.lang, parts, url, true);
    }
  }
  return leaveSpace(ctx, url);
}
