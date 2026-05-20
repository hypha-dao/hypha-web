import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getSpaceBankingRedirectUrl = vi.fn(
  () => 'https://app.hypha.earth/en/dho/acme/banking',
);

vi.mock('../../../common/server/get-app-url', () => ({
  getSpaceBankingRedirectUrl: (...args: unknown[]) =>
    getSpaceBankingRedirectUrl(...args),
}));

import { requestSpaceBankOnboarding } from '../request-space-bank-onboarding';
import type { BankKycProvider } from '../providers/types';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const insertBankCustomer = vi.fn();

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

const mockDb = {} as never;

const onboardingInput = {
  spaceSlug: 'acme',
  authToken: 'token',
  legalName: 'Acme Foundation Ltd.',
  contactEmail: 'compliance@acme.org',
  endorsements: ['base', 'sepa'] as const,
};

const mockProvider: BankKycProvider = {
  provider: 'bridge',
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
      kycStatus: 'not_started',
      kycLink: 'https://bridge.example/kyc',
      tosLink: 'https://bridge.example/tos',
      name: onboardingInput.legalName,
      contactEmail: onboardingInput.contactEmail,
      endorsements: ['base', 'sepa'],
    });
  });

  it('throws BankOnboardingError 404 when space is not found', async () => {
    findSpaceBySlug.mockResolvedValue(null);

    await expect(
      requestSpaceBankOnboarding(
        { ...onboardingInput, endorsements: [...onboardingInput.endorsements] },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Space not found',
    });

    expect(authorizeSpaceBankOnboarding).not.toHaveBeenCalled();
  });

  it('throws BankOnboardingError when authorization fails', async () => {
    authorizeSpaceBankOnboarding.mockResolvedValue({
      authorized: false,
      httpStatus: 403,
      message: 'You must be a space member or delegate to enable bank accounts.',
    });

    await expect(
      requestSpaceBankOnboarding(
        { ...onboardingInput, endorsements: [...onboardingInput.endorsements] },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: 'You must be a space member or delegate to enable bank accounts.',
    });

    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });

  it('returns existing customer without calling provider (idempotent)', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      kycStatus: 'under_review',
      kycLink: 'https://bridge.example/existing',
      tosLink: null,
      name: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      endorsements: ['base', 'sepa'],
    });

    const result = await requestSpaceBankOnboarding(
      { ...onboardingInput, endorsements: [...onboardingInput.endorsements] },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.created).toBe(false);
    expect(result.spaceTitle).toBe('Acme');
    expect(result.requesterSlug).toBe('alice');
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
    expect(insertBankCustomer).not.toHaveBeenCalled();
  });

  it('creates customer via provider with request body fields', async () => {
    const result = await requestSpaceBankOnboarding(
      { ...onboardingInput, endorsements: [...onboardingInput.endorsements] },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(getSpaceBankingRedirectUrl).toHaveBeenCalledWith('acme');
    expect(mockProvider.createKycLink).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        endorsements: ['base', 'sepa'],
        redirectUri: 'https://app.hypha.earth/en/dho/acme/banking',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        adminPersonId: 10,
        name: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        endorsements: ['base', 'sepa'],
      }),
      expect.any(Object),
    );
    expect(result.created).toBe(true);
    expect(result.spaceTitle).toBe('Acme');
    expect(result.requesterSlug).toBe('alice');
  });
});
