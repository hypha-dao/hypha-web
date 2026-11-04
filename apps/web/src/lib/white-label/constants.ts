/** Public prefix of the iframe delivery. */
export const EMBED_PREFIX = 'embed';
/** Internal prefix of the white-label tree. Never served to outside requests. */
export const INTERNAL_PREFIX = 'wl';

/** Request headers set by middleware after resolving. Stripped on the way in. */
export const WL_SPACE_HEADER = 'x-hypha-wl-space';
export const WL_MODE_HEADER = 'x-hypha-wl-mode';
/** Set on requests middleware sends to the white-label 404 (see global-not-found). */
export const WL_NOT_FOUND_HEADER = 'x-hypha-wl-not-found';
export const WL_REQUEST_HEADERS = [
  WL_SPACE_HEADER,
  WL_MODE_HEADER,
  WL_NOT_FOUND_HEADER,
] as const;

/** Section shown when `/embed/<slug>` has no section segment. */
export const LANDING_SECTION = 'overview';

/**
 * Internal path for white-label 404s. It matches no route on purpose, so Next
 * renders the single global-not-found, which picks the bare shell from the
 * `WL_NOT_FOUND_HEADER` set alongside it.
 */
export const INTERNAL_NOT_FOUND_PATH = `/${INTERNAL_PREFIX}/_`;
