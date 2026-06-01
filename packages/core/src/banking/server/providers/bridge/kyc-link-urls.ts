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

/**
 * Constructs the Persona-hosted Source of Funds questionnaire URL for a customer.
 * Extracts developer_id and reference-id from the existing kyc_link and swaps in
 * the SoF inquiry template ID from the environment (falling back to a built-in
 * default). Returns null if the kyc_link cannot be parsed or is missing
 * developer_id / reference-id.
 */
// Known-stable Persona template for the Bridge-hosted SoF questionnaire.
// Overridable via env var in case Bridge rotates the template ID.
const DEFAULT_SOF_INQUIRY_TEMPLATE_ID = 'itmpl_SymuEkuKMNbTaPmuz8Rr3Nhu6jSD';

export function buildBridgeSofUrl(kycLinkUrl: string): string | null {
  const templateId =
    process.env.BRIDGE_PERSONA_SOF_INQUIRY_TEMPLATE_ID ||
    DEFAULT_SOF_INQUIRY_TEMPLATE_ID;

  try {
    const src = new URL(kycLinkUrl);
    const developerId = src.searchParams.get('fields[developer_id]');
    const referenceId = src.searchParams.get('reference-id');

    if (!developerId || !referenceId) {
      return null;
    }

    const sof = new URL('https://bridge.withpersona.com/verify');
    sof.searchParams.set('fields[developer_id]', developerId);
    sof.searchParams.set('inquiry-template-id', templateId);
    sof.searchParams.set('reference-id', referenceId);
    return sof.toString();
  } catch {
    return null;
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
