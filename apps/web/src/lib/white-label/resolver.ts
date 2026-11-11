import {
  API_PREFIX,
  EMBED_PREFIX,
  INTERNAL_PREFIX,
  LANDING_SECTION,
} from './constants';
import { isApiReadAllowed } from './api-allowlist';
import { isValidSlug, normaliseHost } from './config';
import type {
  ResolveDecision,
  ResolveOptions,
  WhiteLabelConfig,
  WhiteLabelHostClientRecord,
  WhiteLabelHostRecord,
} from './types';

/**
 * Splits a request pathname into decoded segments, or null when the path is
 * malformed: empty inner segments (`//`), dot segments, encoded separators,
 * control characters, bad percent-encoding.
 */
export function splitPath(path: string): string[] | null {
  if (!path.startsWith('/')) return null;
  const parts = path.slice(1).split('/');
  // A single trailing slash is fine (`/embed/x/`); any other empty segment is not.
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  const segments: string[] = [];
  for (const part of parts) {
    if (part === '') return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      return null;
    }
    if (decoded === '' || decoded === '.' || decoded === '..') return null;
    // eslint-disable-next-line no-control-regex
    if (/[/\\\u0000-\u001f\u007f]/.test(decoded)) return null;
    segments.push(decoded);
  }
  return segments;
}

/** Language subtags that map onto a supported locale code. */
const LANGUAGE_ALIASES: Record<string, string> = { nb: 'no', nn: 'no' };

/**
 * Best supported locale for an `Accept-Language` header, or null. Honours
 * q-values and primary subtags (`pt-BR` -> `pt`); ignores `*` and `q=0`.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  locales: readonly string[],
): string | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.toLowerCase().startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight, index };
    })
    .filter(
      (entry) =>
        entry.tag !== '' &&
        entry.tag !== '*' &&
        Number.isFinite(entry.weight) &&
        entry.weight > 0,
    )
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    const primary = tag.split('-')[0] ?? '';
    const candidate = LANGUAGE_ALIASES[primary] ?? primary;
    if (locales.includes(tag)) return tag;
    if (locales.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * Locale for a request that is not served (the white-label 404 page): the
 * locale segment when present (after the slug under `/embed`, first on a
 * mapped host), else the cookie (host only), else the browser language.
 */
export function localeForPath(
  path: string,
  options: ResolveOptions,
  hostMode = false,
): string {
  const segments = splitPath(path);
  const candidate = segments?.[hostMode ? 0 : 2];
  if (candidate !== undefined && options.locales.includes(candidate)) {
    return candidate;
  }
  if (hostMode && options.localeCookie) {
    if (options.locales.includes(options.localeCookie)) {
      return options.localeCookie;
    }
  }
  return (
    negotiateLocale(options.acceptLanguage, options.locales) ??
    options.defaultLocale
  );
}

/** True when `host` is one of the mapped hosts (host delivery). */
export function isMappedHost(
  config: WhiteLabelConfig,
  host: string | null | undefined,
): boolean {
  const requestHost = normaliseHost(host);
  return (
    requestHost !== null &&
    findMappedHost(config.hostClients, requestHost) !== null
  );
}

/**
 * Main-app host check. A local dev host matches by hostname, whatever its port
 * (`localhost:3000`); any other host must match exactly.
 */
function isMainHost(config: WhiteLabelConfig, requestHost: string): boolean {
  if (config.mainHosts.includes(requestHost)) return true;
  const hostname = requestHost.replace(/:[0-9]+$/, '');
  return (
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    config.mainHosts.includes(hostname)
  );
}

/** Decoded, lower-cased first path segment. */
function firstSegment(path: string): string {
  let first = path.split('/')[1] ?? '';
  try {
    first = decodeURIComponent(first);
  } catch {
    /* keep raw; compared as-is by the callers */
  }
  return first.toLowerCase();
}

function findMappedHost(
  clients: readonly WhiteLabelHostClientRecord[],
  host: string,
): { client: WhiteLabelHostClientRecord; record: WhiteLabelHostRecord } | null {
  for (const client of clients) {
    const record = client.hosts.find((h) => h.host === host);
    if (record) return { client, record };
  }
  return null;
}

/**
 * Host delivery: a mapped host serves one Space at its root. `/<section>` and
 * `/<locale>/<section>` are rewritten to the internal `/wl/<slug>/<locale>/...`
 * tree the iframe delivery uses. The first segment is a locale or a section,
 * never a Space slug, and the two sets are disjoint (tested), so it is
 * unambiguous. Locale: path, then cookie (first party here), then
 * `Accept-Language`, then the default.
 */
function resolveMappedHost(
  client: WhiteLabelHostClientRecord,
  record: WhiteLabelHostRecord,
  path: string,
  options: ResolveOptions,
): ResolveDecision {
  const first = firstSegment(path);
  if (first === INTERNAL_PREFIX) {
    return { kind: 'not-found', reason: 'internal-prefix' };
  }
  const segments = splitPath(path);
  if (first === API_PREFIX) {
    if (!segments) return { kind: 'not-found', reason: 'malformed-path' };
    return isApiReadAllowed(options.method, segments, record.spaceSlug)
      ? { kind: 'api-allow' }
      : { kind: 'not-found', reason: 'api-not-allowed' };
  }
  // The iframe delivery lives on the main host only.
  if (first === EMBED_PREFIX) {
    return { kind: 'not-found', reason: 'embed-not-served' };
  }
  if (!segments) return { kind: 'not-found', reason: 'malformed-path' };

  const rest = [...segments];
  let locale: string | null = null;
  let localeFromPath = false;
  const candidate = rest[0];
  if (candidate !== undefined && options.locales.includes(candidate)) {
    locale = candidate;
    localeFromPath = true;
    rest.shift();
  }
  if (
    locale === null &&
    options.localeCookie &&
    options.locales.includes(options.localeCookie)
  ) {
    locale = options.localeCookie;
  }
  locale ??=
    negotiateLocale(options.acceptLanguage, options.locales) ??
    options.defaultLocale;

  const section = rest.length === 0 ? [LANDING_SECTION] : rest;
  return {
    kind: 'rewrite',
    mode: 'host',
    pathname: `/${INTERNAL_PREFIX}/${record.spaceSlug}/${locale}/${section
      .map(encodeURIComponent)
      .join('/')}`,
    clientId: client.id,
    clientIds: [client.id],
    spaces: [record.spaceSlug],
    spaceSlug: record.spaceSlug,
    locale,
    localeFromPath,
    framingOrigins: [],
    ...(record.authConfig ? { authConfig: record.authConfig } : {}),
  };
}

/**
 * Pure decision for one request. The host identifies the client in the host
 * delivery (A1); in the iframe delivery it is not used and the path alone
 * identifies the Space. Nothing the visitor can forge is trusted: hosts and
 * slugs are checked against the approved lists.
 *
 * Feature off (no approved clients and no mapped hosts): everything passes
 * through and `/embed` is not served. With hosts mapped, a host that is
 * neither mapped nor a main-app host is not served.
 */
export function resolve(
  host: string | null | undefined,
  path: string,
  config: WhiteLabelConfig,
  options: ResolveOptions,
): ResolveDecision {
  const hasEmbed = config.clients.length > 0;
  const hasHosts = config.hostClients.length > 0;
  if (!hasEmbed && !hasHosts) return { kind: 'pass' };

  if (hasHosts) {
    const requestHost = normaliseHost(host);
    const mapped = requestHost
      ? findMappedHost(config.hostClients, requestHost)
      : null;
    if (mapped) {
      return resolveMappedHost(mapped.client, mapped.record, path, options);
    }
    if (!requestHost || !isMainHost(config, requestHost)) {
      return { kind: 'not-found', reason: 'unknown-host' };
    }
  }

  // Compare the decoded, lower-cased first segment so `/%77l`, `/WL` and
  // `/Embed` can not slip past the prefix checks below.
  const first = firstSegment(path);

  // Internal tree reached directly from outside: never served.
  if (first === INTERNAL_PREFIX) {
    return { kind: 'not-found', reason: 'internal-prefix' };
  }
  if (first !== EMBED_PREFIX) return { kind: 'pass' };

  const segments = splitPath(path);
  // The raw prefix must be exactly `embed` (no encoded or re-cased variants).
  if (
    !segments ||
    segments[0] !== EMBED_PREFIX ||
    path.split('/')[1] !== EMBED_PREFIX
  ) {
    return { kind: 'not-found', reason: 'malformed-path' };
  }

  const [, slug, ...rest] = segments;
  if (!slug || !isValidSlug(slug)) {
    return { kind: 'not-found', reason: 'unapproved-space' };
  }

  const clientIds: string[] = [];
  const origins = new Set<string>();
  for (const client of config.clients) {
    const matches = client.spaces.filter((s) => s.slug === slug);
    if (matches.length === 0) continue;
    clientIds.push(client.id);
    for (const space of matches) {
      for (const origin of space.framingOrigins) origins.add(origin);
    }
  }
  if (clientIds.length === 0) {
    return { kind: 'not-found', reason: 'unapproved-space' };
  }

  // Optional locale segment right after the slug. Locale codes and section
  // names are disjoint, so the first segment is unambiguous.
  let locale: string | null = null;
  const candidate = rest[0];
  if (candidate !== undefined && options.locales.includes(candidate)) {
    locale = candidate;
    rest.shift();
  }
  // No locale in the path: the browser's language, then the default.
  locale ??=
    negotiateLocale(options.acceptLanguage, options.locales) ??
    options.defaultLocale;

  // `/embed/<slug>/api/...` is never served: the app's own `/api` is same-origin.
  if (rest[0] === API_PREFIX) {
    return { kind: 'not-found', reason: 'api-not-served' };
  }

  const section = rest.length === 0 ? [LANDING_SECTION] : rest;
  return {
    kind: 'rewrite',
    mode: 'embed',
    pathname: `/${INTERNAL_PREFIX}/${slug}/${locale}/${section
      .map(encodeURIComponent)
      .join('/')}`,
    clientIds,
    spaceSlug: slug,
    locale,
    framingOrigins: [...origins],
  };
}
