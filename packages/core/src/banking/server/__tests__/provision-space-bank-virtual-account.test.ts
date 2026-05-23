import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const syncBankCustomerKycFromBridge = vi.fn();
const persistVirtualAccountEndorsementFromBridge = vi.fn();
const fetchBridgeCustomerEndorsementStatuses = vi.fn();

vi.mock('../sync-bank-customer-kyc-from-bridge', () => ({
  syncBankCustomerKycFromBridge: (...args: unknown[]) =>
    syncBankCustomerKycFromBridge(...args),
}));

vi.mock('../sync-bank-virtual-account-endorsement', () => ({
  persistVirtualAccountEndorsementFromBridge: (...args: unknown[]) =>
    persistVirtualAccountEndorsementFromBridge(...args),
}));

vi.mock('../bridge-customer-endorsements', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../bridge-customer-endorsements')
  >();
  return {
    ...actual,
    fetchBridgeCustomerEndorsementStatuses: (...args: unknown[]) =>
      fetchBridgeCustomerEndorsementStatuses(...args),
  };
});

vi.mock('../../../common/server/bridge-sandbox', () => ({
  isBridgeSandboxApi: () => false,
}));

vi.mock('../simulate-bridge-kyb-data', () => ({
  simulateBridgeKybData: vi.fn().mockResolvedValue(undefined),
}));

import { BANK_SETUP_FAILED_USER_MESSAGE } from '../errors';
import { provisionSpaceBankVirtualAccount } from '../provision-space-bank-virtual-account';
import type { BankKycProvider } from '../providers/types';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const findBankVirtualAccountByCorridorAndCustomer = vi.fn();
const insertBankVirtualAccount = vi.fn();
const updateBankVirtualAccount = vi.fn();

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
  findBankVirtualAccountByCorridorAndCustomer: (...args: unknown[]) =>
    findBankVirtualAccountByCorridorAndCustomer(...args),
}));

vi.mock('../mutations', () => ({
  insertBankVirtualAccount: (...args: unknown[]) =>
    insertBankVirtualAccount(...args),
  updateBankVirtualAccount: (...args: unknown[]) =>
    updateBankVirtualAccount(...args),
}));

const mockDb = {} as never;

const provisionInput = {
  spaceSlug: 'acme',
  authToken: 'token',
  currency: 'eur',
};

const approvedCustomer = {
  id: 5,
  spaceId: 1,
  kycStatus: 'approved',
  providerCustomerId: 'cust_1',
  providerKycLinkId: 'link_1',
};

const mockProvider: BankKycProvider = {
  provider: 'bridge',
  createKycLink: vi.fn(),
  createTransfer: vi.fn(),
  provisionVirtualAccount: vi.fn().mockResolvedValue({
    providerVirtualAccountId: 'va_1',
    currency: 'eur',
    paymentRail: 'sepa',
    depositInstructions: { iban: 'DE00' },
    status: 'activated',
  }),
};

describe('provisionSpaceBankVirtualAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceBySlug.mockResolvedValue({
      id: 1,
      slug: 'acme',
      address: '0xtreasury',
    });
    authorizeSpaceBankOnboarding.mockResolvedValue({
      authorized: true,
      person: { id: 10, slug: 'alice' },
    });
    findBankCustomerBySpaceAndProvider.mockResolvedValue(approvedCustomer);
    findBankVirtualAccountByCorridorAndCustomer.mockResolvedValue(null);
    insertBankVirtualAccount.mockResolvedValue({
      currency: 'eur',
      paymentRail: 'sepa',
      depositInstructions: { iban: 'DE00' },
      status: 'activated',
    });
    fetchBridgeCustomerEndorsementStatuses.mockResolvedValue(
      new Map([['sepa', 'approved']]),
    );
    persistVirtualAccountEndorsementFromBridge.mockImplementation(
      async (account) => ({
        account: { ...account, isApproved: true },
        isApproved: true,
      }),
    );
  });

  it('throws 404 when space is not found', async () => {
    findSpaceBySlug.mockResolvedValue(null);

    await expect(
      provisionSpaceBankVirtualAccount(provisionInput, { db: mockDb }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 403 when authorization fails', async () => {
    authorizeSpaceBankOnboarding.mockResolvedValue({
      authorized: false,
      httpStatus: 403,
      message: 'Forbidden',
    });

    await expect(
      provisionSpaceBankVirtualAccount(provisionInput, { db: mockDb }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when bank customer does not exist', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(null);

    await expect(
      provisionSpaceBankVirtualAccount(provisionInput, { db: mockDb }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns existing account without calling provider (idempotent)', async () => {
    findBankVirtualAccountByCorridorAndCustomer.mockResolvedValue({
      id: 9,
      currency: 'eur',
      paymentRail: 'sepa',
      providerVirtualAccountId: 'va_existing',
      depositInstructions: { iban: 'DE00' },
      status: 'activated',
      isApproved: true,
    });

    const result = await provisionSpaceBankVirtualAccount(
      provisionInput,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.created).toBe(false);
    expect(mockProvider.provisionVirtualAccount).not.toHaveBeenCalled();
  });

  it('throws 403 when corridor endorsement is not approved', async () => {
    fetchBridgeCustomerEndorsementStatuses.mockResolvedValue(
      new Map([['sepa', 'incomplete']]),
    );

    await expect(
      provisionSpaceBankVirtualAccount(
        provisionInput,
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockProvider.provisionVirtualAccount).not.toHaveBeenCalled();
  });

  it('syncs KYB from Bridge when DB is not approved then provisions', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      ...approvedCustomer,
      kycStatus: 'under_review',
      providerCustomerId: null,
    });
    syncBankCustomerKycFromBridge.mockResolvedValue({
      customer: approvedCustomer,
      isApproved: true,
    });

    const result = await provisionSpaceBankVirtualAccount(
      provisionInput,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(syncBankCustomerKycFromBridge).toHaveBeenCalled();
    expect(mockProvider.provisionVirtualAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        currency: 'eur',
        destinationAddress: '0xtreasury',
      }),
    );
    expect(result.created).toBe(true);
  });

  it('throws 422 when customer_id is still missing after sync', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      ...approvedCustomer,
      providerCustomerId: null,
    });
    syncBankCustomerKycFromBridge.mockResolvedValue({
      customer: { ...approvedCustomer, providerCustomerId: null },
      isApproved: true,
    });

    await expect(
      provisionSpaceBankVirtualAccount(
        provisionInput,
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('provisions a new virtual account when KYB is approved', async () => {
    const result = await provisionSpaceBankVirtualAccount(
      provisionInput,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(mockProvider.provisionVirtualAccount).toHaveBeenCalled();
    expect(insertBankVirtualAccount).toHaveBeenCalled();
    expect(result.created).toBe(true);
  });

  it('maps Bridge 4xx to actionable BankOnboardingError', async () => {
    const bridgeError = new Error('Bridge API error (400): {...}');
    (bridgeError as Error & { status: number }).status = 400;
    mockProvider.provisionVirtualAccount.mockRejectedValueOnce(bridgeError);

    await expect(
      provisionSpaceBankVirtualAccount(
        provisionInput,
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: BANK_SETUP_FAILED_USER_MESSAGE,
    });
  });
});
