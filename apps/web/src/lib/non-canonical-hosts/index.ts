import type { Header, Redirect } from 'next/dist/lib/load-custom-routes';
import { DEFAULT_APP_HOST } from '../white-label/config';

/**
 * Hosts that serve the app but are not the canonical one (#2696, #2690).
 *
 * Both rules below are Next.js config routes: Vercel evaluates them at the
 * edge, before the middleware and before any function, so they cost no
 * function run and also cover paths the middleware matcher skips (`public/`
 * files, `.well-known`).
 */

/** The project's default Vercel alias. Indexed by Google earlier; no longer canonical. */
export const STALE_ALIAS_HOST = 'hypha-web-three.vercel.app';

/**
 * Neon fetches the JWKS from this exact path on the alias and does NOT follow
 * redirects. It must keep answering 200 there. Never redirect it.
 */
export const JWKS_PATH = '/.well-known/jwks.json';

/**
 * Hosts that get `X-Robots-Tag: noindex`: PR previews, the bare preview host
 * and any `*.vercel.app` host. Next.js compiles a `has` value as `^value$`
 * without grouping, so the alternation is wrapped in a group: lookalike hosts
 * must not match. The canonical host and white-label hosts never match.
 */
export const NON_CANONICAL_HOST_PATTERN =
  '(?:pr-[0-9]+\\.preview-app\\.hypha\\.earth|preview-app\\.hypha\\.earth|[a-z0-9-]+\\.vercel\\.app)';

/** `source` matching every path except the JWKS path (the path is regex-escaped). */
const ALL_PATHS_BUT_JWKS = '/:path((?!\\.well-known/jwks\\.json$).*)';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type HostCondition = NonNullable<Header['missing']>;

/** Mapped (white-label) hosts are sites of their own: never touched. */
export function buildNoindexHeaderRule(
  notMappedHost: HostCondition | undefined,
) {
  return {
    source: '/:path*',
    has: [{ type: 'host' as const, value: NON_CANONICAL_HOST_PATTERN }],
    missing: notMappedHost,
    headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  };
}

/**
 * The stale alias redirects (308, path and query kept) to the canonical host,
 * except the JWKS path. Only this one host: deployment-specific `*.vercel.app`
 * URLs are used by internal self-calls (`VERCEL_URL`, crons) and must not move.
 */
export function buildStaleAliasRedirectRule(
  notMappedHost: HostCondition | undefined,
): Redirect & { source: string; destination: string } {
  return {
    source: ALL_PATHS_BUT_JWKS,
    has: [
      {
        type: 'host',
        value: escapeRegExp(STALE_ALIAS_HOST),
      },
    ],
    missing: notMappedHost,
    destination: `https://${DEFAULT_APP_HOST}/:path`,
    permanent: true,
  };
}
