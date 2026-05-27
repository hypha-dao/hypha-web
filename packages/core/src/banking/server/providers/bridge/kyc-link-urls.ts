/**
 * Bridge returns tos_link with redirect_uri set to our app return URL (from POST
 * redirect_uri). After ToS acceptance we need the user on kyc_link instead.
 * Rewrite tos_link so redirect_uri points at kyc_link; kyc_link keeps Bridge's
 * original redirect_uri for the final return to Hypha.
 */
export function rewriteBridgeTosLinkRedirectUri(
  tosLink: string | null | undefined,
  kycLink: string,
): string | null {
  if (!tosLink?.trim()) {
    return null;
  }

  try {
    const url = new URL(tosLink);
    url.searchParams.delete('redirect_uri');
    url.searchParams.set('redirect_uri', kycLink);
    return url.toString();
  } catch {
    return tosLink;
  }
}

export function mapBridgeKycLinkUrls(response: {
  kyc_link: string;
  tos_link?: string | null;
}): { kycLink: string; tosLink: string | null } {
  const kycLink = response.kyc_link;
  return {
    kycLink,
    tosLink: rewriteBridgeTosLinkRedirectUri(response.tos_link, kycLink),
  };
}
