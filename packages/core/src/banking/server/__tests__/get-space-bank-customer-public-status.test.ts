import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findBankCustomerBySpaceAndProvider = vi.fn();
const fetchBridgeKycLinkLive = vi.fn();

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: (...args: unknown[]) =>
    findBankCustomerBySpaceAndProvider(...args),
}));

vi.mock('../fetch-bridge-kyc-link-live', () => ({
  fetchBridgeKycLinkLive: (...args: unknown[]) =>
    fetchBridgeKycLinkLive(...args),
  isBridgeKycProcedureSubmitted: (status: string | null | undefined) =>
    status === 'approved' || status === 'under_review',
  isBridgeTosProcedureSubmitted: (status: string | null | undefined) =>
    status === 'approved',
}));

import { getSpaceBankCustomerPublicStatus } from '../get-space-bank-customer-public-status';

const mockDb = {} as never;
const space = { id: 1 };

const pendingCustomer = {
  id: 10,
  kycStatus: 'pending',
  tosStatus: 'pending',
  kycLink: 'https://bridge.example/kyc',
  tosLink: 'https://bridge.example/tos',
  providerKycLinkId: 'link_1',
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
    expect(fetchBridgeKycLinkLive).not.toHaveBeenCalled();
  });

  it('returns DB-only status when already approved in database', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      ...pendingCustomer,
      kycStatus: 'approved',
      tosStatus: 'approved',
    });

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(fetchBridgeKycLinkLive).not.toHaveBeenCalled();
    expect(result?.isApproved).toBe(true);
    expect(result?.approvalRegistered).toBe(true);
    expect(result?.procedures.tos.isComplete).toBe(true);
    expect(result?.procedures.tos.link).toBe(pendingCustomer.tosLink);
  });

  it('reads Bridge live status without persisting when not registered', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(pendingCustomer);
    fetchBridgeKycLinkLive.mockResolvedValue({
      kycStatus: 'approved',
      tosStatus: 'approved',
      isKycApproved: true,
      isTosApproved: true,
      providerCustomerId: 'cust_1',
    });

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(fetchBridgeKycLinkLive).toHaveBeenCalledWith(pendingCustomer);
    expect(result?.isApproved).toBe(true);
    expect(result?.approvalRegistered).toBe(false);
    expect(result?.procedures.kyc.status).toBe('approved');
    expect(result?.procedures.kyc.isComplete).toBe(true);
    expect(result?.procedures.tos.isComplete).toBe(true);
    expect(result?.tosLink).toBe(pendingCustomer.tosLink);
  });

  it('falls back to DB when Bridge live read fails', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue(pendingCustomer);
    fetchBridgeKycLinkLive.mockRejectedValue(new Error('Bridge down'));

    const result = await getSpaceBankCustomerPublicStatus(space, {
      db: mockDb,
    });

    expect(result?.isApproved).toBe(false);
    expect(result?.procedures.kyc.status).toBe('pending');
    expect(result?.procedures.kyc.isComplete).toBe(false);
  });
});
