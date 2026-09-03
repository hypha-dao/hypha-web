import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const bridgeGetKycLink = vi.fn();

vi.mock('../../../../common/server/bridge-client', () => ({
  bridgeGetKycLink: (...args: unknown[]) => bridgeGetKycLink(...args),
}));

import { createBridgeKycProvider } from '../bridge/adapter';
import { getBankIdentityProvider, getBankKycProvider } from '../registry';
import { bankProviderManifest } from '../manifest';

describe('registry — identity vs. KYC providers (D6)', () => {
  it('getBankIdentityProvider returns the Bridge adapter', () => {
    const provider = getBankIdentityProvider('bridge');
    expect(provider.provider).toBe('bridge');
    expect(typeof provider.getKycStatus).toBe('function');
    expect(typeof provider.createKycLink).toBe('function');
  });

  it('getBankKycProvider still returns a full Bridge adapter', () => {
    const provider = getBankKycProvider('bridge');
    expect(typeof provider.provisionVirtualAccount).toBe('function');
    expect(typeof provider.createTransfer).toBe('function');
  });

  it('getBankKycProvider("audd") throws — AUDD is identity-only', () => {
    expect(() => getBankKycProvider('audd')).toThrow(/Unsupported bank KYC/);
  });

  it('getBankIdentityProvider("audd") throws until the WS3 adapter lands', () => {
    expect(() => getBankIdentityProvider('audd')).toThrow(
      /Unsupported bank identity/,
    );
  });
});

describe('manifest', () => {
  it('declares aud for audd and the Bridge currency set for bridge', () => {
    expect(bankProviderManifest.audd.supportedCurrencies).toEqual(['aud']);
    expect([...bankProviderManifest.bridge.supportedCurrencies].sort()).toEqual(
      ['brl', 'cop', 'eur', 'gbp', 'mxn', 'usd'].sort(),
    );
  });

  it('both providers require email + legal name (D10 — deduped by the form)', () => {
    for (const provider of ['bridge', 'audd'] as const) {
      const keys = bankProviderManifest[provider].requiredOnboardingFields.map(
        (field) => field.key,
      );
      expect(keys).toContain('contactEmail');
      expect(keys).toContain('legalName');
    }
    expect(
      bankProviderManifest.audd.requiredOnboardingFields.map((f) => f.key),
    ).toContain('companyType');
  });
});

describe('Bridge getKycStatus — thin wrapper over the existing status path (D6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the customer row has no KYC link yet', async () => {
    const provider = createBridgeKycProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'bridge',
        providerKycLinkId: null,
        providerCustomerId: null,
      },
    });
    expect(result).toBeNull();
    expect(bridgeGetKycLink).not.toHaveBeenCalled();
  });

  it('maps a live Bridge KYC link to the provider-neutral snapshot', async () => {
    bridgeGetKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_status: 'approved',
      tos_status: 'approved',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'bridge',
        providerKycLinkId: 'kyc_link_1',
        providerCustomerId: 'cust_1',
      },
    });

    expect(result).toEqual({
      kycStatus: 'approved',
      isApproved: true,
      tosStatus: 'approved',
      kycLink: null,
    });
  });

  it('isApproved is false unless both KYC and ToS are approved', async () => {
    bridgeGetKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_status: 'approved',
      tos_status: 'pending',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'bridge',
        providerKycLinkId: 'kyc_link_1',
        providerCustomerId: 'cust_1',
      },
    });

    expect(result?.isApproved).toBe(false);
  });
});

describe('Bridge getOnboardingStepDescriptor (D12)', () => {
  it('describes an external KYC link step carrying the created link URL', () => {
    const provider = createBridgeKycProvider();
    const descriptor = provider.getOnboardingStepDescriptor({
      kycLink: 'https://bridge.example/kyc',
    });
    expect(descriptor).toEqual({
      kind: 'external_kyc_link',
      url: 'https://bridge.example/kyc',
      i18nKeys: {
        title: 'BankingTab.onboardingSteps.kyc.title',
        body: 'BankingTab.onboardingSteps.kyc.body',
      },
    });
  });
});
