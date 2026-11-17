/** Public prefix of the iframe delivery. */
export const EMBED_PREFIX = 'embed';
/**
 * Query parameter that names the client in the iframe delivery (`/embed`). It
 * picks one client's settings when several approve the same Space.
 */
export const WL_CLIENT_PARAM = 'client';
/** Internal prefix of the white-label tree. Never served to outside requests. */
export const INTERNAL_PREFIX = 'wl';
/** First path segment of the app's own API. */
export const API_PREFIX = 'api';

/** How a request reaches the white-label tree. */
export type WhiteLabelMode = 'embed' | 'host';

/** Request headers set by middleware after resolving. Stripped on the way in. */
export const WL_SPACE_HEADER = 'x-hypha-wl-space';
export const WL_MODE_HEADER = 'x-hypha-wl-mode';
/** Resolved client id (host mode). */
export const WL_CLIENT_HEADER = 'x-hypha-wl-client';
/** JSON of the host's auth config (host mode, when configured). Public values only. */
export const WL_AUTH_HEADER = 'x-hypha-wl-auth';
/** How a card opens a detail page: `embedded` (overlay on the host) or `full-app`. */
export const WL_DETAIL_VIEW_HEADER = 'x-hypha-wl-detail-view';
/** What a visitor sees for an action the delivery cannot perform: `hide` or `full-app`. */
export const WL_UNSUPPORTED_ACTIONS_HEADER = 'x-hypha-wl-unsupported-actions';
/** Create flows the host may offer (comma-joined known values), host with login only. */
export const WL_CREATE_ACTIONS_HEADER = 'x-hypha-wl-create-actions';
/** Set on requests middleware sends to the white-label 404 (see global-not-found). */
export const WL_NOT_FOUND_HEADER = 'x-hypha-wl-not-found';
export const WL_REQUEST_HEADERS = [
  WL_SPACE_HEADER,
  WL_MODE_HEADER,
  WL_CLIENT_HEADER,
  WL_AUTH_HEADER,
  WL_DETAIL_VIEW_HEADER,
  WL_UNSUPPORTED_ACTIONS_HEADER,
  WL_CREATE_ACTIONS_HEADER,
  WL_NOT_FOUND_HEADER,
] as const;

/**
 * Create flows a client may enable on a host with login. Two proposal types
 * are separate values on purpose: a single `proposal` value would widen for
 * every client when a type is added. New types get new values.
 */
export const CREATE_ACTIONS = ['signal', 'agreement', 'contribution'] as const;

/** Section shown when `/embed/<slug>` or the host root has no section segment. */
export const LANDING_SECTION = 'overview';

/**
 * The sections the `(wl)` tree serves (one page each under `wl/[id]/[lang]`).
 * Disjoint from the locale codes (tested): in host mode the first path segment
 * is a locale or a section.
 */
export const WL_SECTIONS = [
  'overview',
  'agreements',
  'banking',
  'calendar',
  'coherence',
  'ecosystem-navigation',
  'energy',
  'members',
  'memory',
  'pipeline',
  'rewards',
  'treasury',
] as const;

/** Cookie next-intl uses for the chosen locale (read in host mode only). */
export const WL_LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Internal path for white-label 404s. It matches no route on purpose, so Next
 * renders the single global-not-found, which picks the bare shell from the
 * `WL_NOT_FOUND_HEADER` set alongside it.
 */
export const INTERNAL_NOT_FOUND_PATH = `/${INTERNAL_PREFIX}/_`;
