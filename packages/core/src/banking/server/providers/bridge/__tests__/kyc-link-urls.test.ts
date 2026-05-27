import { describe, expect, it } from 'vitest';

import {
  mapBridgeKycLinkUrls,
  rewriteBridgeTosLinkRedirectUri,
} from '../kyc-link-urls';

describe('rewriteBridgeTosLinkRedirectUri', () => {
  const kycLink =
    'https://bridge.xyz/kyc?session=abc&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Freturn';

  it('replaces redirect_uri on tos_link with the kyc_link URL', () => {
    const tosLink =
      'https://bridge.xyz/tos?session=abc&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Ftreasury';

    const result = rewriteBridgeTosLinkRedirectUri(tosLink, kycLink);

    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.searchParams.get('redirect_uri')).toBe(kycLink);
    expect(url.searchParams.get('redirect_uri')).not.toContain('/treasury');
  });

  it('returns null when tos_link is absent', () => {
    expect(rewriteBridgeTosLinkRedirectUri(null, kycLink)).toBeNull();
    expect(rewriteBridgeTosLinkRedirectUri(undefined, kycLink)).toBeNull();
  });

  it('returns original string when tos_link is not a valid URL', () => {
    expect(rewriteBridgeTosLinkRedirectUri('not-a-url', kycLink)).toBe(
      'not-a-url',
    );
  });
});

describe('mapBridgeKycLinkUrls', () => {
  it('passes kyc_link through and rewrites tos_link', () => {
    const kyc =
      'https://bridge.example/kyc?redirect_uri=https%3A%2F%2Fapp%2Freturn';
    const tos =
      'https://bridge.example/tos?redirect_uri=https%3A%2F%2Fapp%2Freturn';

    const mapped = mapBridgeKycLinkUrls({
      kyc_link: kyc,
      tos_link: tos,
    });

    expect(mapped.kycLink).toBe(kyc);
    expect(new URL(mapped.tosLink!).searchParams.get('redirect_uri')).toBe(kyc);
  });
});
