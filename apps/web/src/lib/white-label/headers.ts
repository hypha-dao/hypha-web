import {
  CREATE_ACTIONS,
  WL_REQUEST_HEADERS,
  WL_SPACE_HEADER,
  WL_TABS,
} from './constants';
import { knownTabs } from './tabs';
import type { CreateAction, Tab } from './types';

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

/** Header value for `createActions` (known values only, comma-joined). */
export function serializeCreateActions(
  actions: readonly CreateAction[],
): string {
  return actions.join(',');
}

/**
 * Parses the header the layout receives. Fail closed: only the exact known
 * values count, anything else (or no header) is "none".
 */
export function readCreateActionsHeader(
  raw: string | null | undefined,
): CreateAction[] {
  if (!raw) return [];
  const known: readonly string[] = CREATE_ACTIONS;
  return [
    ...new Set(
      raw
        .split(',')
        .map((part) => part.trim())
        .filter((part): part is CreateAction => known.includes(part)),
    ),
  ];
}

/** Header value for `tabs` (known ids, comma-joined, in the bar's order). */
export function serializeTabs(tabs: readonly Tab[]): string {
  return tabs.join(',');
}

/**
 * Parses the header the layout receives. Fail open, like the config: no
 * header, or one with no known id, is all tabs in product order. The header
 * only drives presentation; the resolver already refused hidden tabs.
 */
export function readTabsHeader(raw: string | null | undefined): Tab[] {
  const tabs = raw ? knownTabs(raw.split(',').map((part) => part.trim())) : [];
  return tabs.length > 0 ? tabs : [...WL_TABS];
}
