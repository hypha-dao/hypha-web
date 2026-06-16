import { describe, expect, it } from 'vitest';

import {
  buildBridgeSofUrl,
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

describe('buildBridgeSofUrl', () => {
  const kycLink =
    'https://bridge.withpersona.com/verify' +
    '?fields%5Bdeveloper_id%5D=e737a8eb-8501-4b83-9424-9a6e29553666' +
    '&fields%5Bemail_address%5D=user%40example.com' +
    '&fields%5Biqt_token%5D=WwzmNl3bpmDX' +
    '&inquiry-template-id=itmpl_wKuJEFST4JKViF2zcfmNJJJs' +
    '&reference-id=65bef635-f95e-46e3-a6c7-48820e77fb66';

  it('constructs the SoF URL using the default template ID', () => {
    const result = buildBridgeSofUrl(kycLink);
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.searchParams.get('fields[developer_id]')).toBe(
      'e737a8eb-8501-4b83-9424-9a6e29553666',
    );
    expect(url.searchParams.get('reference-id')).toBe(
      '65bef635-f95e-46e3-a6c7-48820e77fb66',
    );
    expect(url.searchParams.get('inquiry-template-id')).toBe(
      'itmpl_SymuEkuKMNbTaPmuz8Rr3Nhu6jSD',
    );
  });

  it('strips session-specific params (email_address, iqt_token) from the SoF URL', () => {
    const result = buildBridgeSofUrl(kycLink);
    const url = new URL(result!);
    expect(url.searchParams.get('fields[email_address]')).toBeNull();
    expect(url.searchParams.get('fields[iqt_token]')).toBeNull();
  });

  it('returns null when the KYC URL is missing developer_id', () => {
    const noDevId =
      'https://bridge.withpersona.com/verify?reference-id=abc&inquiry-template-id=itmpl_123';
    expect(buildBridgeSofUrl(noDevId)).toBeNull();
  });

  it('returns null when the KYC URL is missing reference-id', () => {
    const noRef =
      'https://bridge.withpersona.com/verify?fields%5Bdeveloper_id%5D=dev123&inquiry-template-id=itmpl_123';
    expect(buildBridgeSofUrl(noRef)).toBeNull();
  });

  it('returns null when the KYC URL is not a valid URL', () => {
    expect(buildBridgeSofUrl('not-a-url')).toBeNull();
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
