/**
 * `/api` reads a mapped host may call (A1). Everything else under `/api` is
 * refused on a mapped host: the read-only sections need these and nothing more.
 * Widen per endpoint when login and writes arrive.
 *
 * Patterns are decoded path segments; `:name` matches exactly one segment.
 * Only GET and HEAD are ever allowed.
 */
export const WL_API_READ_ALLOWLIST: readonly string[] = [
  // Measured: requested by the section pages of a Space (browser run on a
  // mapped host); a missing entry shows as a 404 on that call.
  '/api/v1/spaces/:slug',
  '/api/v1/spaces/:slug/energy',
  '/api/v1/spaces/:slug/coherences',
  '/api/v1/spaces/:slug/members',
  '/api/v1/spaces/:slug/assets',
  '/api/v1/spaces/:slug/assets-without-balances',
  '/api/v1/spaces/:slug/transfers',
  '/api/v1/spaces/:slug/vaults',
  '/api/v1/spaces/:slug/org-memory',
  '/api/v1/spaces/:slug/scheduled-items',
  // Measured on a mapped host after A1 shipped: Agreements, Overview and
  // Treasury returned 404 on these until listed.
  '/api/v1/spaces/:slug/documents',
  '/api/v1/spaces/:slug/documents/all',
  '/api/v1/spaces/:slug/overview-activity',
  '/api/v1/spaces/:slug/token-holdings',
  '/api/v1/currency-rates',
  '/api/v1/tokens/:address/supply',
  // Scoped to the host's own Space inside the handler (not in this path rule):
  // they answer on a mapped host only for that Space, via the Space header
  // middleware sets. `:documentSlug` is a document slug, not the Space slug.
  '/api/v1/events',
  '/api/v1/spaces',
  '/api/v1/documents/:documentSlug/voters',
  // Read from the hooks of sections not exercised by that run (pipeline is
  // off for the test Space): kept until they are measured, then confirm or drop.
  '/api/v1/spaces/:slug/pipeline/config',
  '/api/v1/spaces/:slug/deals',
  '/api/v1/spaces/:slug/energy/telemetry',
];

const PARAM_SEGMENT = /^[A-Za-z0-9_.-]{1,200}$/;
/** Document slugs come from `slugify` and may hold a few more characters. */
const DOCUMENT_SLUG_SEGMENT = /^[A-Za-z0-9_.~+*$()'!:@-]{1,255}$/;
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

function matches(
  pattern: string,
  segments: readonly string[],
  ownSlug: string | undefined,
): boolean {
  const expected = pattern.split('/').filter(Boolean);
  if (expected.length !== segments.length) return false;
  return expected.every((part, index) => {
    const actual = segments[index] as string;
    // `:slug` is the Space slug: only the host's own Space is allowed.
    if (part === ':slug') {
      return (
        ownSlug !== undefined &&
        actual === ownSlug &&
        PARAM_SEGMENT.test(actual)
      );
    }
    if (part === ':documentSlug') return DOCUMENT_SLUG_SEGMENT.test(actual);
    return part.startsWith(':') ? PARAM_SEGMENT.test(actual) : part === actual;
  });
}

/**
 * Whether a mapped host may call this API path with this method. `segments`
 * are the decoded path segments, `api` first (already validated by `splitPath`).
 * `ownSlug` is the host's Space: a Space-scoped (`:slug`) path is allowed for
 * that slug only, and fails closed when it is not given.
 */
export function isApiReadAllowed(
  method: string | undefined,
  segments: readonly string[],
  ownSlug?: string,
  allowlist: readonly string[] = WL_API_READ_ALLOWLIST,
): boolean {
  if (!ALLOWED_METHODS.has((method ?? 'GET').toUpperCase())) return false;
  return allowlist.some((pattern) => matches(pattern, segments, ownSlug));
}
