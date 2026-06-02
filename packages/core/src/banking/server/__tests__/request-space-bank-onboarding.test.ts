import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestSpaceBankOnboarding } from '../request-space-bank-onboarding';
import type { BankKycProvider } from '../providers/types';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const findPersonById = vi.fn();
const insertBankCustomer = vi.fn();
const buildPublicStatusFromCustomer = vi.fn();
const performKycLinkAndInsert = vi.fn();
const initiateEmailConfirmation = vi.fn();

vi.mock('../../../space/server/queries', () => ({
  findSpaceBySlug: (...args: unknown[]) => findSpaceBySlug(...args),
}));

vi.mock('../../../people/server/queries', () => ({
  findPersonById: (...args: unknown[]) => findPersonById(...args),
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

vi.mock('../perform-kyc-link-and-insert', () => ({
  performKycLinkAndInsert: (...args: unknown[]) =>
    performKycLinkAndInsert(...args),
  buildBankOnboardingResultFromKycLink: ({
    kycLinkResult,
    created,
    spaceTitle,
    requesterSlug,
  }: {
    kycLinkResult: {
      kycLink: string;
      tosLink: string | null;
    };
    created: boolean;
    spaceTitle: string;
    requesterSlug: string | null;
  }) => ({
    provider: 'bridge',
    created,
    spaceTitle,
    requesterSlug,
    kycLink: kycLinkResult.kycLink,
    tosLink: kycLinkResult.tosLink,
    procedures: {
      tos: { key: 'tos', status: 'pending', isComplete: false },
      kyc: { key: 'kyc', status: 'not_started', isComplete: false },
    },
  }),
}));

vi.mock('../initiate-email-confirmation', () => ({
  initiateEmailConfirmation: (...args: unknown[]) =>
    initiateEmailConfirmation(...args),
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
  createKycLink: vi.fn(),
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
    findPersonById.mockResolvedValue({ id: 10, email: 'alice@example.com' });
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
    performKycLinkAndInsert.mockResolvedValue({
      created: true,
      kycLinkResult: {
        providerCustomerId: 'cust_1',
        providerKycLinkId: 'link_1',
        kycStatus: 'not_started',
        isApproved: false,
        tosStatus: 'pending',
        kycLink: 'https://bridge.example/kyc',
        tosLink: 'https://bridge.example/tos',
      },
    });
    initiateEmailConfirmation.mockResolvedValue({
      signedJwt: 'signed.jwt.token',
      contactEmail: 'compliance@acme.org',
      spaceTitle: 'Acme',
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

    const output = await requestSpaceBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(output.status).toBe('existing');
    expect(output.result.created).toBe(false);
    expect(performKycLinkAndInsert).not.toHaveBeenCalled();
    expect(insertBankCustomer).not.toHaveBeenCalled();
    expect(initiateEmailConfirmation).not.toHaveBeenCalled();
    expect(buildPublicStatusFromCustomer).toHaveBeenCalled();
  });

  it('initiates email confirmation when submitter email differs', async () => {
    const output = await requestSpaceBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(output.status).toBe('pending_email_confirmation');
    expect(initiateEmailConfirmation).toHaveBeenCalled();
    expect(performKycLinkAndInsert).not.toHaveBeenCalled();
    expect(insertBankCustomer).not.toHaveBeenCalled();
  });

  it('creates customer via bypass when submitter email matches', async () => {
    findPersonById.mockResolvedValue({
      id: 10,
      email: 'compliance@acme.org',
    });

    const output = await requestSpaceBankOnboarding(
      {
        ...onboardingInput,
        requestedRails: [...onboardingInput.requestedRails],
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(output.status).toBe('created');
    expect(performKycLinkAndInsert).toHaveBeenCalled();
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKycLinkId: 'link_1',
        requestedRails: ['eur', 'usd'],
      }),
      expect.any(Object),
    );
    expect(output.result.kycLink).toBe('https://bridge.example/kyc');
  });
});
