/** Public prefix of the iframe delivery. */
export const EMBED_PREFIX = 'embed';
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
/** Set on requests middleware sends to the white-label 404 (see global-not-found). */
export const WL_NOT_FOUND_HEADER = 'x-hypha-wl-not-found';
export const WL_REQUEST_HEADERS = [
  WL_SPACE_HEADER,
  WL_MODE_HEADER,
  WL_CLIENT_HEADER,
  WL_AUTH_HEADER,
  WL_NOT_FOUND_HEADER,
] as const;

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
