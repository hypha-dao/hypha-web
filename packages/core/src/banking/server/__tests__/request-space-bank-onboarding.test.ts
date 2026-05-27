import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestSpaceBankOnboarding } from '../request-space-bank-onboarding';
import type { BankKycProvider } from '../providers/types';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const insertBankCustomer = vi.fn();
const buildPublicStatusFromCustomer = vi.fn();

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

vi.mock('../get-space-bank-customer-public-status', () => ({
  buildPublicStatusFromCustomer: (...args: unknown[]) =>
    buildPublicStatusFromCustomer(...args),
}));

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

const mockProcedures = {
  tos: {
    key: 'tos',
    status: 'pending',
    isComplete: false,
    action: { type: 'link' as const, url: 'https://bridge.example/tos' },
  },
  kyc: {
    key: 'kyc',
    status: 'not_started',
    isComplete: false,
    action: { type: 'link' as const, url: 'https://bridge.example/kyc' },
  },
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
    buildPublicStatusFromCustomer.mockResolvedValue({
      isApproved: false,
      approvalRegistered: false,
      procedures: mockProcedures,
      railStatuses: [],
      currencyStatuses: [],
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
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 1,
      providerKycLinkId: 'link_1',
      requestedRails: ['eur'],
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
    expect(buildPublicStatusFromCustomer).toHaveBeenCalled();
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
