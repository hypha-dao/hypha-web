import { EMBED_PREFIX, INTERNAL_PREFIX, LANDING_SECTION } from './constants';
import { isValidSlug } from './config';
import type {
  ResolveDecision,
  ResolveOptions,
  WhiteLabelConfig,
} from './types';

/** `/embed/<slug>/api/...` is never served: the app's own `/api` is same-origin. */
const API_SEGMENT = 'api';

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
 * locale segment after the slug when present, else the browser language.
 */
export function localeForPath(path: string, options: ResolveOptions): string {
  const segments = splitPath(path);
  const candidate = segments?.[2];
  if (candidate !== undefined && options.locales.includes(candidate)) {
    return candidate;
  }
  return (
    negotiateLocale(options.acceptLanguage, options.locales) ??
    options.defaultLocale
  );
}

/**
 * Pure decision for one request. `host` is accepted for the A1 delivery (host
 * identifies the client) and is unused in the iframe delivery: the path alone
 * identifies the Space. Nothing the visitor can forge is trusted: the slug is
 * checked against the approved list.
 *
 * Feature off (no approved clients): everything passes through and `/embed`
 * is not served.
 */
export function resolve(
  _host: string | null | undefined,
  path: string,
  config: WhiteLabelConfig,
  options: ResolveOptions,
): ResolveDecision {
  if (config.clients.length === 0) return { kind: 'pass' };

  // Compare the decoded, lower-cased first segment so `/%77l`, `/WL` and
  // `/Embed` can not slip past the prefix checks below.
  let first = path.split('/')[1] ?? '';
  try {
    first = decodeURIComponent(first);
  } catch {
    /* keep raw; compared as-is below */
  }
  first = first.toLowerCase();

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

  if (rest[0] === API_SEGMENT) {
    return { kind: 'not-found', reason: 'api-not-served' };
  }

  const section = rest.length === 0 ? [LANDING_SECTION] : rest;
  return {
    kind: 'rewrite',
    pathname: `/${INTERNAL_PREFIX}/${slug}/${locale}/${section
      .map(encodeURIComponent)
      .join('/')}`,
    clientIds,
    spaceSlug: slug,
    locale,
    framingOrigins: [...origins],
  };
}
