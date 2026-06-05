import 'server-only';

/**
 * Bridge KYC redirect after ToS / verification — treasury tab, bank accounts sub-tab.
 */
export function buildBankingKycRedirectUri(
  lang: string,
  spaceSlug: string,
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

  return `${base}/${lang}/dho/${encodeURIComponent(
    spaceSlug,
  )}/treasury?tab=bank-accounts&banking=return`;
}
