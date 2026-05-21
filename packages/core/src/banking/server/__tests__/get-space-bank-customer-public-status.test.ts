import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findBankCustomerBySpaceAndProvider = vi.fn();
const syncBankCustomerKycFromBridge = vi.fn();

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: (...args: unknown[]) =>
    findBankCustomerBySpaceAndProvider(...args),
}));

vi.mock('../sync-bank-customer-kyc-from-bridge', () => ({
  syncBankCustomerKycFromBridge: (...args: unknown[]) =>
    syncBankCustomerKycFromBridge(...args),
}));

import { getSpaceBankCustomerPublicStatus } from '../get-space-bank-customer-public-status';

const mockDb = {} as never;
const space = { id: 1 };

const pendingCustomer = {
  id: 10,
  kycStatus: 'pending',
  kycLink: 'https://bridge.example/kyc',
  tosLink: 'https://bridge.example/tos',
};

describe('getSpaceBankCustomerPublicStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no bank customer exists', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(null);

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(result).toBeNull();
    expect(syncBankCustomerKycFromBridge).not.toHaveBeenCalled();
  });

  it('syncs from Bridge when DB is not approved', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(pendingCustomer);
    syncBankCustomerKycFromBridge.mockResolvedValue({
      customer: { ...pendingCustomer, kycStatus: 'approved' },
      isApproved: true,
    });

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(syncBankCustomerKycFromBridge).toHaveBeenCalledWith(
      pendingCustomer,
      { db: mockDb },
    );
    expect(result).toEqual({
      kycStatus: 'approved',
      kycLink: pendingCustomer.kycLink,
      tosLink: pendingCustomer.tosLink,
      isApproved: true,
    });
  });

  it('skips Bridge sync when already approved in DB', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      ...pendingCustomer,
      kycStatus: 'approved',
    });

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(syncBankCustomerKycFromBridge).not.toHaveBeenCalled();
    expect(result?.isApproved).toBe(true);
  });

  it('returns DB status when Bridge sync fails', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(pendingCustomer);
    syncBankCustomerKycFromBridge.mockRejectedValue(new Error('Bridge down'));

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(result).toEqual({
      kycStatus: 'pending',
      kycLink: pendingCustomer.kycLink,
      tosLink: pendingCustomer.tosLink,
      isApproved: false,
    });
  });
});
