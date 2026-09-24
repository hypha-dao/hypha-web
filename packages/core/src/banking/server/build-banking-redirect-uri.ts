import 'server-only';
import { getAppBaseUrl } from '../../common/server/get-app-url';

/**
 * Bridge KYC redirect after ToS / verification — treasury tab, bank accounts sub-tab.
 *
 * The origin comes from `getAppBaseUrl()` (`NEXT_PUBLIC_APP_URL`, else the deployment host on
 * previews, else the canonical app origin on production). This used to be
 * `a ?? b ? x : y`, which parses as `(a ?? b) ? x : y`: on Vercel `VERCEL_URL` is always set, so
 * it always used the per-deployment host and ignored `NEXT_PUBLIC_APP_URL` — users returned from KYC
 * onto another origin, signed out. Local dev (nothing configured) still returns localhost.
 */
export function buildBankingKycRedirectUri(
  lang: string,
  spaceSlug: string,
): string {
  const hasConfiguredOrigin = Boolean(
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim(),
  );
  const base = hasConfiguredOrigin ? getAppBaseUrl() : 'http://localhost:3000';

  return `${base}/${lang}/dho/${encodeURIComponent(
    spaceSlug,
  )}/treasury?tab=bank-accounts&banking=return`;
}
