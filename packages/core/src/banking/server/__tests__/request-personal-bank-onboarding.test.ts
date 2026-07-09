import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestPersonalBankOnboarding } from '../request-personal-bank-onboarding';
import type { BankKycProvider } from '../providers/types';

const findPersonBySlug = vi.fn();
const authorizePersonalBankOnboarding = vi.fn();
const findBankCustomerByPersonAndProvider = vi.fn();
const insertBankCustomer = vi.fn();
const bridgeGetKycLink = vi.fn();

vi.mock('../../../people/server/queries', () => ({
  findPersonBySlug: (...args: unknown[]) => findPersonBySlug(...args),
}));

vi.mock('../authorize-personal-bank-onboarding', () => ({
  authorizePersonalBankOnboarding: (...args: unknown[]) =>
    authorizePersonalBankOnboarding(...args),
}));

vi.mock('../queries', () => ({
  findBankCustomerByPersonAndProvider: (...args: unknown[]) =>
    findBankCustomerByPersonAndProvider(...args),
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
  personSlug: 'alice',
  authToken: 'token',
  legalName: 'Alice Doe',
  contactEmail: 'alice@example.org',
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

describe('requestPersonalBankOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPersonBySlug.mockResolvedValue({
      id: 10,
      slug: 'alice',
      name: 'Alice',
      email: 'alice@example.org',
    });
    authorizePersonalBankOnboarding.mockResolvedValue({
      authorized: true,
      person: { id: 10, slug: 'alice' },
    });
    findBankCustomerByPersonAndProvider.mockResolvedValue(null);
    insertBankCustomer.mockResolvedValue({
      id: 1,
      providerKycLinkId: 'link_1',
      requestedRails: ['eur', 'usd'],
    });
  });

  it('throws BankOnboardingError 404 when the person is not found', async () => {
    findPersonBySlug.mockResolvedValue(null);

    await expect(
      requestPersonalBankOnboarding(
        {
          ...onboardingInput,
          requestedRails: [...onboardingInput.requestedRails],
        },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Person not found',
    });
  });

  it('throws when the caller is not the profile owner', async () => {
    authorizePersonalBankOnboarding.mockResolvedValue({
      authorized: false,
      message: 'You can only manage banking for your own profile.',
      httpStatus: 403,
    });

    await expect(
      requestPersonalBankOnboarding(
        {
          ...onboardingInput,
          requestedRails: [...onboardingInput.requestedRails],
        },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });

  it('returns existing customer without calling provider (idempotent)', async () => {
    const existingCustomer = {
      id: 1,
      providerKycLinkId: 'link_1',
      providerCustomerId: 'cust_1',
      requestedRails: ['eur'],
    };
    findBankCustomerByPersonAndProvider.mockResolvedValue(existingCustomer);
    bridgeGetKycLink.mockResolvedValue({
      id: 'link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      tos_link: 'https://bridge.example/tos',
      kyc_status: 'under_review',
      tos_status: 'approved',
    });

    const result = await requestPersonalBankOnboarding(
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

  it('creates an individual customer with personId set', async () => {
    const result = await requestPersonalBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(mockProvider.createKycLink).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'individual',
        legalName: 'Alice Doe',
        contactEmail: 'alice@example.org',
        endorsements: ['sepa', 'base'],
        idempotencyKey: expect.any(String),
      }),
    );
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 10,
        entityType: 'individual',
        providerKycLinkId: 'link_1',
        requestedRails: ['eur', 'usd'],
      }),
      expect.any(Object),
    );
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.not.objectContaining({ spaceId: expect.anything() }),
      expect.any(Object),
    );
    expect(result.created).toBe(true);
    expect(result.ownerName).toBe('Alice Doe');
    expect(result.kycLink).toBe('https://bridge.example/kyc');
  });
});
