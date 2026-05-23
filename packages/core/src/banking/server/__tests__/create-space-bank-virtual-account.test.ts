import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const persistVirtualAccountEndorsementFromBridge = vi.fn();
const requestBridgeEndorsementKycLink = vi.fn();
const provisionSpaceBankVirtualAccount = vi.fn();

vi.mock('../sync-bank-virtual-account-endorsement', () => ({
  persistVirtualAccountEndorsementFromBridge: (...args: unknown[]) =>
    persistVirtualAccountEndorsementFromBridge(...args),
}));

vi.mock('../request-bridge-endorsement-kyc-link', () => ({
  requestBridgeEndorsementKycLink: (...args: unknown[]) =>
    requestBridgeEndorsementKycLink(...args),
}));

vi.mock('../provision-space-bank-virtual-account', () => ({
  provisionSpaceBankVirtualAccount: (...args: unknown[]) =>
    provisionSpaceBankVirtualAccount(...args),
}));

import { createSpaceBankVirtualAccount } from '../create-space-bank-virtual-account';

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const findBankVirtualAccountByCorridorAndCustomer = vi.fn();
const insertBankVirtualAccount = vi.fn();

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
}));

const mockDb = {} as never;

const createInput = {
  spaceSlug: 'acme',
  authToken: 'token',
  currency: 'mxn',
};

const customer = {
  id: 5,
  spaceId: 1,
  kycStatus: 'approved',
  providerCustomerId: 'cust_1',
  kycLink: 'https://bridge.example/kyc',
  tosLink: 'https://bridge.example/tos',
};

const pendingAccount = {
  id: 11,
  bankCustomerId: 5,
  currency: 'mxn',
  paymentRail: 'spei',
  providerVirtualAccountId: null,
  depositInstructions: {},
  destinationAddress: '0xtreasury',
  status: 'pending_kyb',
  isApproved: false,
};

describe('createSpaceBankVirtualAccount', () => {
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
    findBankCustomerBySpaceAndProvider.mockResolvedValue(customer);
    findBankVirtualAccountByCorridorAndCustomer.mockResolvedValue(null);
    insertBankVirtualAccount.mockResolvedValue(pendingAccount);
    persistVirtualAccountEndorsementFromBridge.mockResolvedValue({
      account: pendingAccount,
      isApproved: false,
    });
    requestBridgeEndorsementKycLink.mockResolvedValue({
      ...customer,
      kycLink: 'https://bridge.example/kyc-mxn',
    });
    provisionSpaceBankVirtualAccount.mockResolvedValue({
      id: 11,
      currency: 'mxn',
      paymentRail: 'spei',
      lifecycle: 'active',
      created: false,
    });
  });

  it('returns already_active when provider resource exists', async () => {
    findBankVirtualAccountByCorridorAndCustomer.mockResolvedValue({
      ...pendingAccount,
      providerVirtualAccountId: 'va_1',
      isApproved: true,
      status: 'activated',
    });

    const result = await createSpaceBankVirtualAccount(createInput, {
      db: mockDb,
    });

    expect(result.action).toBe('already_active');
    expect(insertBankVirtualAccount).not.toHaveBeenCalled();
    expect(provisionSpaceBankVirtualAccount).not.toHaveBeenCalled();
  });

  it('requests endorsement KYC when corridor is not approved', async () => {
    const result = await createSpaceBankVirtualAccount(createInput, {
      db: mockDb,
    });

    expect(insertBankVirtualAccount).toHaveBeenCalled();
    expect(requestBridgeEndorsementKycLink).toHaveBeenCalledWith(
      customer,
      'spei',
      { db: mockDb },
    );
    expect(result).toEqual(
      expect.objectContaining({
        action: 'kyc_required',
        currency: 'mxn',
        kycLink: 'https://bridge.example/kyc-mxn',
      }),
    );
    expect(provisionSpaceBankVirtualAccount).not.toHaveBeenCalled();
  });

  it('provisions when corridor endorsement is approved', async () => {
    persistVirtualAccountEndorsementFromBridge.mockResolvedValue({
      account: { ...pendingAccount, isApproved: true },
      isApproved: true,
    });

    const result = await createSpaceBankVirtualAccount(createInput, {
      db: mockDb,
    });

    expect(provisionSpaceBankVirtualAccount).toHaveBeenCalledWith(
      { spaceSlug: 'acme', authToken: 'token', currency: 'mxn' },
      { db: mockDb },
      undefined,
    );
    expect(result.action).toBe('provisioned');
    expect(requestBridgeEndorsementKycLink).not.toHaveBeenCalled();
  });
});
