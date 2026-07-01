import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const isBridgeSandboxApi = vi.fn(() => true);
const isBankingSandboxDemoEnabled = vi.fn(() => true);
const simulateBridgeKybData = vi.fn();
const bridgeSimulateKycApproval = vi.fn();
const resolveBridgeCustomerId = vi.fn();
const findSpaceBySlug = vi.fn();
const authorizeSpaceBankOnboarding = vi.fn();
const findBankCustomerBySpaceAndProvider = vi.fn();

vi.mock('../../../common/server/bridge-sandbox', () => ({
  isBridgeSandboxApi: () => isBridgeSandboxApi(),
  isBankingSandboxDemoEnabled: () => isBankingSandboxDemoEnabled(),
}));

vi.mock('../simulate-bridge-kyb-data', () => ({
  simulateBridgeKybData: (...args: unknown[]) => simulateBridgeKybData(...args),
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
    isBridgeSandboxApi.mockReturnValue(true);
    isBankingSandboxDemoEnabled.mockReturnValue(true);
    findSpaceBySlug.mockResolvedValue({
      id: 10,
      slug: 'acme',
      title: 'Hypha Test Space',
    });
    authorizeSpaceBankOnboarding.mockResolvedValue({ authorized: true });
    findBankCustomerBySpaceAndProvider.mockResolvedValue(bankCustomer);
    resolveBridgeCustomerId.mockResolvedValue({
      customerId: 'cust_1',
      customer: bankCustomer,
    });
    simulateBridgeKybData.mockResolvedValue(undefined);
    bridgeSimulateKycApproval.mockResolvedValue({
      success: true,
      customer_id: 'cust_1',
      kyc_status: 'approved',
      message: 'ok',
    });
  });

  it('rejects when sandbox demo env flag is off', async () => {
    isBankingSandboxDemoEnabled.mockReturnValue(false);

    await expect(
      simulateSpaceBankKycApproval(
        { spaceSlug: 'acme', authToken: 'token' },
        { db: mockDb },
      ),
    ).rejects.toMatchObject({ message: 'KYB simulation is not enabled' });

    expect(bridgeSimulateKycApproval).not.toHaveBeenCalled();
    expect(simulateBridgeKybData).not.toHaveBeenCalled();
  });

  it('rejects when Bridge API is not sandbox', async () => {
    isBridgeSandboxApi.mockReturnValue(false);

    await expect(
      simulateSpaceBankKycApproval(
        { spaceSlug: 'acme', authToken: 'token' },
        { db: mockDb },
      ),
    ).rejects.toMatchObject({
      message:
        'KYC simulation is only available against the Bridge sandbox API',
    });

    expect(bridgeSimulateKycApproval).not.toHaveBeenCalled();
    expect(simulateBridgeKybData).not.toHaveBeenCalled();
  });

  it('simulates KYB approval before mock KYB data PUT', async () => {
    await simulateSpaceBankKycApproval(
      { spaceSlug: 'acme', authToken: 'token' },
      { db: mockDb },
    );

    expect(bridgeSimulateKycApproval.mock.invocationCallOrder[0]!).toBeLessThan(
      simulateBridgeKybData.mock.invocationCallOrder[0]!,
    );
    expect(simulateBridgeKybData).toHaveBeenCalledWith('cust_1', {
      businessLegalName: 'Hypha Test Space',
      force: true,
    });
    expect(bridgeSimulateKycApproval).toHaveBeenCalledWith(
      'cust_1',
      expect.any(String),
    );
  });

  it('skips mock KYB data when includeKybData is false', async () => {
    await simulateSpaceBankKycApproval(
      { spaceSlug: 'acme', authToken: 'token', includeKybData: false },
      { db: mockDb },
    );

    expect(bridgeSimulateKycApproval).toHaveBeenCalled();
    expect(simulateBridgeKybData).not.toHaveBeenCalled();
  });

  it('does not apply mock KYB data when simulate_kyc_approval fails', async () => {
    bridgeSimulateKycApproval.mockRejectedValue(new Error('not sandbox'));

    await expect(
      simulateSpaceBankKycApproval(
        { spaceSlug: 'acme', authToken: 'token' },
        { db: mockDb },
      ),
    ).rejects.toThrow('not sandbox');

    expect(simulateBridgeKybData).not.toHaveBeenCalled();
  });
});
