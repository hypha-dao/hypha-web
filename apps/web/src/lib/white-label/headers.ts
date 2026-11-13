import { WL_REQUEST_HEADERS, WL_SPACE_HEADER } from './constants';

/** Value of CSP `frame-ancestors` for a response. `'none'` unless origins given. */
export function buildFrameAncestors(origins: readonly string[]): string {
  return origins.length > 0 ? origins.join(' ') : "'none'";
}

/**
 * Copy of request headers without any white-label header a visitor may have
 * sent. Middleware calls this on every request it resolves, then adds its own.
 */
export function stripWhiteLabelHeaders(headers: Headers): Headers {
  const copy = new Headers(headers);
  for (const name of WL_REQUEST_HEADERS) copy.delete(name);
  return copy;
}

/**
 * Request headers for an `/api` route. Inbound white-label headers are always
 * dropped. A mapped-host request (`mappedSpaceSlug` given, already validated by
 * the allowlist) then carries the Space header, so a route can tell it from a
 * main-host request, which never has one.
 */
export function apiRequestHeaders(
  headers: Headers,
  mappedSpaceSlug?: string,
): Headers {
  const copy = stripWhiteLabelHeaders(headers);
  if (mappedSpaceSlug) copy.set(WL_SPACE_HEADER, mappedSpaceSlug);
  return copy;
}

export type FramingPolicy = {
  /** `X-Frame-Options` value, or null to send none (framing by CSP only). */
  xFrameOptions: 'DENY' | null;
  frameAncestors: string;
};

/** Main app, unknown hosts, `/wl` direct: exactly the existing policy. */
export const DENY_FRAMING: FramingPolicy = {
  xFrameOptions: 'DENY',
  frameAncestors: "'none'",
};

/**
 * Mapped host: the page is first party and nothing may frame it. `'none'`
 * (not `'self'`): no section frames anything of its own.
 */
export const HOST_FRAMING: FramingPolicy = DENY_FRAMING;

export function embedFraming(origins: readonly string[]): FramingPolicy {
  return {
    // No origins (config drops such Spaces, so this stays closed) keeps DENY.
    xFrameOptions: origins.length > 0 ? null : 'DENY',
    frameAncestors: buildFrameAncestors(origins),
  };
}
