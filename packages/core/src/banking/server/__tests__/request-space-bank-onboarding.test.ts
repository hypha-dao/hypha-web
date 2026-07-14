import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestSpaceBankOnboarding } from '../request-space-bank-onboarding';
import type { BankKycProvider } from '../providers/types';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const insertBankCustomer = vi.fn();
const bridgeGetKycLink = vi.fn();

vi.mock('../../../space/server/queries', () => ({
  findSpaceBySlug: (...args: unknown[]) => findSpaceBySlug(...args),
}));

vi.mock('../authorize-space-bank-onboarding', () => ({
  authorizeSpaceBankOnboarding: (...args: unknown[]) =>
    authorizeSpaceBankOnboarding(...args),
}));

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: (...args: unknown[]) =>
    findBankCustomerBySpaceAndProvider(...args),
}));

vi.mock('../mutations', () => ({
  insertBankCustomer: (...args: unknown[]) => insertBankCustomer(...args),
}));

vi.mock('../../../common/server/bridge-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../common/server/bridge-client')
  >('../../../common/server/bridge-client');
  return {
    ...actual,
    bridgeGetKycLink: (...args: unknown[]) => bridgeGetKycLink(...args),
  };
});

const mockDb = {} as never;

const onboardingInput = {
  spaceSlug: 'acme',
  authToken: 'token',
  legalName: 'Acme Foundation Ltd.',
  contactEmail: 'compliance@acme.org',
  requestedRails: ['eur', 'usd'] as const,
};

const mockProvider: BankKycProvider = {
  provider: 'bridge',
  provisionVirtualAccount: vi.fn(),
  createTransfer: vi.fn(),
  registerExternalAccount: vi.fn(),
  createLiquidationAddress: vi.fn(),
  createKycLink: vi.fn().mockResolvedValue({
    providerCustomerId: 'cust_1',
    providerKycLinkId: 'link_1',
    kycStatus: 'not_started',
    isApproved: false,
    tosStatus: 'pending',
    kycLink: 'https://bridge.example/kyc',
    tosLink: 'https://bridge.example/tos',
  }),
};

describe('requestSpaceBankOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceBySlug.mockResolvedValue({
      id: 1,
      title: 'Acme',
      slug: 'acme',
      web3SpaceId: 42,
      address: '0xtreasury',
    });
    authorizeSpaceBankOnboarding.mockResolvedValue({
      authorized: true,
      person: { id: 10, slug: 'alice' },
    });
    findBankCustomerBySpaceAndProvider.mockResolvedValue(null);
    insertBankCustomer.mockResolvedValue({
      id: 1,
      providerKycLinkId: 'link_1',
      requestedRails: ['eur', 'usd'],
    });
  });

  it('throws BankOnboardingError 404 when space is not found', async () => {
    findSpaceBySlug.mockResolvedValue(null);

    await expect(
      requestSpaceBankOnboarding(
        {
          ...onboardingInput,
          requestedRails: [...onboardingInput.requestedRails],
        },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Space not found',
    });
  });

  it('returns existing customer without calling provider (idempotent)', async () => {
    const existingCustomer = {
      id: 1,
      providerKycLinkId: 'link_1',
      providerCustomerId: 'cust_1',
      requestedRails: ['eur'],
    };
    findBankCustomerBySpaceAndProvider.mockResolvedValue(existingCustomer);
    bridgeGetKycLink.mockResolvedValue({
      id: 'link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      tos_link: 'https://bridge.example/tos',
      kyc_status: 'under_review',
      tos_status: 'approved',
    });

    const result = await requestSpaceBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.created).toBe(false);
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
    expect(insertBankCustomer).not.toHaveBeenCalled();
    expect(bridgeGetKycLink).toHaveBeenCalledWith('link_1');
    expect(result.kycLink).toBe('https://bridge.example/kyc');
    // buildCustomerValidations rewrites tos_link's redirect_uri to point at the kyc_link.
    expect(result.tosLink).toBe(
      'https://bridge.example/tos?redirect_uri=https%3A%2F%2Fbridge.example%2Fkyc',
    );
  });

  it('creates customer via provider with requested rails', async () => {
    const result = await requestSpaceBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(mockProvider.createKycLink).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        endorsements: ['sepa', 'base'],
        idempotencyKey: expect.any(String),
      }),
    );
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKycLinkId: 'link_1',
        requestedRails: ['eur', 'usd'],
      }),
      expect.any(Object),
    );
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.not.objectContaining({ contactEmail: expect.anything() }),
      expect.any(Object),
    );
    expect(result.created).toBe(true);
    expect(result.kycLink).toBe('https://bridge.example/kyc');
  });
});
