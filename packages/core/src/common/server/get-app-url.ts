import 'server-only';

/** Hypha web app origin (not marketing `NEXT_PUBLIC_ROOT_URL`). */
const DEFAULT_APP_BASE_URL = 'https://app.hypha.earth';

const DEFAULT_LOCALE = 'en';

/**
 * Absolute origin for the Hypha web app (no trailing slash).
 * Prefer `NEXT_PUBLIC_APP_URL`; on Vercel previews use `VERCEL_URL`.
 *
 * `VERCEL_URL` is the per-deployment hostname (`hypha-<hash>-….vercel.app`) — fine for a preview,
 * but on production it is the wrong origin for user-facing links: a different origin from
 * `app.hypha.earth` means no session cookie (users land signed out) and the link dies once the
 * deployment is superseded. So on production it is skipped and the canonical default wins.
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel && process.env.VERCEL_ENV !== 'production') {
    const host = vercel.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }

  return DEFAULT_APP_BASE_URL;
}

/** Locale-prefixed DHO path (leading slash, no origin). */
export function getSpaceDhoPath(
  spaceSlug: string,
  segment: string,
  locale: string = DEFAULT_LOCALE,
): string {
  return `/${locale}/dho/${spaceSlug}/${segment}`;
}

export function getAbsoluteAppUrl(
  path: string,
  baseUrl: string = getAppBaseUrl(),
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
