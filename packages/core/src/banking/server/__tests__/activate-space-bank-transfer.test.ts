import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();
const findBankTransferById = vi.fn();
const syncBankCustomerKycFromBridge = vi.fn();
const promotePendingBankOperations = vi.fn();
const executeBridgeBankTransfer = vi.fn();
const updateBankTransfer = vi.fn();
const mapBankTransferToPublic = vi.fn((transfer) => ({
  ...transfer,
  lifecycle: 'active',
  canActivate: false,
  canContinueVerification: false,
  createdAt: new Date().toISOString(),
}));

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
  findBankTransferById: (...args: unknown[]) => findBankTransferById(...args),
}));

vi.mock('../sync-bank-customer-kyc-from-bridge', () => ({
  syncBankCustomerKycFromBridge: (...args: unknown[]) =>
    syncBankCustomerKycFromBridge(...args),
}));

vi.mock('../promote-pending-bank-operations', () => ({
  promotePendingBankOperations: (...args: unknown[]) =>
    promotePendingBankOperations(...args),
}));

vi.mock('../execute-bridge-bank-transfer', () => ({
  executeBridgeBankTransfer: (...args: unknown[]) =>
    executeBridgeBankTransfer(...args),
}));

vi.mock('../mutations', () => ({
  updateBankTransfer: (...args: unknown[]) => updateBankTransfer(...args),
}));

vi.mock('../map-bank-transfer-public', () => ({
  mapBankTransferToPublic: (...args: unknown[]) =>
    mapBankTransferToPublic(...args),
}));

import { activateSpaceBankTransfer } from '../activate-space-bank-transfer';

const mockDb = {} as never;

const space = { id: 1, slug: 'acme', address: '0xtreasury' };

const approvedCustomer = {
  id: 10,
  kycStatus: 'approved',
  providerCustomerId: 'cust_1',
};

describe('activateSpaceBankTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceBySlug.mockResolvedValue(space);
    authorizeSpaceBankOnboarding.mockResolvedValue({ authorized: true });
    findBankCustomerBySpaceAndProvider.mockResolvedValue(approvedCustomer);
    syncBankCustomerKycFromBridge.mockResolvedValue({
      customer: approvedCustomer,
      isApproved: true,
    });
    promotePendingBankOperations.mockResolvedValue(undefined);
    executeBridgeBankTransfer.mockResolvedValue({
      providerTransferId: 'transfer_1',
      currency: 'usd',
      paymentRail: 'wire',
      amount: null,
      depositMessage: 'BRG7msg',
      depositInstructions: {},
      status: 'awaiting_funds',
      destinationAddress: '0xtreasury',
    });
    updateBankTransfer.mockResolvedValue({
      id: 5,
      currency: 'usd',
      paymentRail: 'wire',
      status: 'awaiting_funds',
    });
  });

  it('uses stored paymentRail instead of defaulting USD to ACH', async () => {
    findBankTransferById.mockResolvedValue({
      id: 5,
      providerTransferId: null,
      currency: 'usd',
      paymentRail: 'wire',
      amount: null,
      status: 'pending_activation',
    });

    await activateSpaceBankTransfer(
      { spaceSlug: 'acme', authToken: 'token', transferId: 5 },
      { db: mockDb },
    );

    expect(executeBridgeBankTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'usd',
        paymentRail: 'wire',
      }),
      { db: mockDb },
      undefined,
    );
  });

  it('returns 403 when KYB is still not approved', async () => {
    findBankTransferById.mockResolvedValue({
      id: 6,
      providerTransferId: null,
      currency: 'eur',
      paymentRail: 'sepa',
      amount: null,
      status: 'pending_activation',
    });
    syncBankCustomerKycFromBridge.mockResolvedValue({
      customer: { ...approvedCustomer, kycStatus: 'incomplete' },
      isApproved: false,
    });

    await expect(
      activateSpaceBankTransfer(
        { spaceSlug: 'acme', authToken: 'token', transferId: 6 },
        { db: mockDb },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
