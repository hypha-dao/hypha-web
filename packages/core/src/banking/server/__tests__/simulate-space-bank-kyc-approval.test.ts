import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const isBridgeSandboxApi = vi.fn(() => true);
const applyBridgeSandboxCustomerMockAddress = vi.fn();
const bridgeSimulateKycApproval = vi.fn();
const resolveBridgeCustomerId = vi.fn();
const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();

vi.mock('../../../common/server/bridge-sandbox', () => ({
  isBridgeSandboxApi: () => isBridgeSandboxApi(),
}));

vi.mock('../bridge-sandbox-mock-customer-address', () => ({
  applyBridgeSandboxCustomerMockAddress: (...args: unknown[]) =>
    applyBridgeSandboxCustomerMockAddress(...args),
}));

vi.mock('../../../common/server/bridge-client', () => ({
  bridgeSimulateKycApproval: (...args: unknown[]) =>
    bridgeSimulateKycApproval(...args),
}));

vi.mock('../resolve-bridge-customer-id', () => ({
  resolveBridgeCustomerId: (...args: unknown[]) =>
    resolveBridgeCustomerId(...args),
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
}));

import { simulateSpaceBankKycApproval } from '../simulate-space-bank-kyc-approval';

const mockDb = {} as never;

const bankCustomer = {
  id: 1,
  entityType: 'business',
  name: 'Hypha Test Space',
  providerKycLinkId: 'kyc_link_1',
};

describe('simulateSpaceBankKycApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceBySlug.mockResolvedValue({ id: 10, slug: 'acme' });
    authorizeSpaceBankOnboarding.mockResolvedValue({ authorized: true });
    findBankCustomerBySpaceAndProvider.mockResolvedValue(bankCustomer);
    resolveBridgeCustomerId.mockResolvedValue({
      customerId: 'cust_1',
      customer: bankCustomer,
    });
    applyBridgeSandboxCustomerMockAddress.mockResolvedValue(undefined);
    bridgeSimulateKycApproval.mockResolvedValue({
      success: true,
      customer_id: 'cust_1',
      kyc_status: 'approved',
      message: 'ok',
    });
  });

  it('applies mock address from Bridge customer type before simulate KYB', async () => {
    await simulateSpaceBankKycApproval(
      { spaceSlug: 'acme', authToken: 'token' },
      { db: mockDb },
    );

    expect(
      applyBridgeSandboxCustomerMockAddress.mock.invocationCallOrder[0]!,
    ).toBeLessThan(bridgeSimulateKycApproval.mock.invocationCallOrder[0]!);
    expect(applyBridgeSandboxCustomerMockAddress).toHaveBeenCalledWith(
      'cust_1',
      { businessLegalName: 'Hypha Test Space', force: true },
    );
    expect(bridgeSimulateKycApproval).toHaveBeenCalledWith(
      'cust_1',
      expect.any(String),
    );
  });
});
