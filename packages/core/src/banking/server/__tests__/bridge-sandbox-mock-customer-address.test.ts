import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeGetCustomer = vi.fn();
const bridgeUpdateCustomer = vi.fn();

vi.mock('../../../common/server/bridge-client', () => ({
  bridgeGetCustomer: (...args: unknown[]) => bridgeGetCustomer(...args),
  bridgeUpdateCustomer: (...args: unknown[]) => bridgeUpdateCustomer(...args),
}));

import {
  BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
  applyBridgeSandboxCustomerMockAddress,
  buildBridgeSandboxCustomerAddressUpdate,
} from '../bridge-sandbox-mock-customer-address';

describe('buildBridgeSandboxCustomerAddressUpdate', () => {
  it('uses residential_address for individual customers', () => {
    expect(buildBridgeSandboxCustomerAddressUpdate('individual')).toEqual({
      type: 'individual',
      residential_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    });
  });

  it('uses full physical and registered addresses for business customers', () => {
    expect(
      buildBridgeSandboxCustomerAddressUpdate('business', 'Acme DAO'),
    ).toEqual({
      type: 'business',
      physical_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
      registered_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
      business_legal_name: 'Acme DAO',
    });
  });
});

describe('applyBridgeSandboxCustomerMockAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridgeUpdateCustomer.mockResolvedValue({});
  });

  it('PUTs complete physical_address when Bridge business customer is missing it', async () => {
    bridgeGetCustomer.mockResolvedValue({
      id: 'cust_1',
      type: 'business',
      physical_address: { subdivision: null, country: null },
      registered_address: { subdivision: 'CA', country: 'USA' },
    });

    await applyBridgeSandboxCustomerMockAddress('cust_1', {
      businessLegalName: 'Sandbox Business',
    });

    expect(bridgeUpdateCustomer).toHaveBeenCalledWith(
      'cust_1',
      expect.objectContaining({
        type: 'business',
        physical_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
      }),
    );
  });

  it('skips PUT when business physical_address is already complete', async () => {
    bridgeGetCustomer.mockResolvedValue({
      id: 'cust_1',
      type: 'business',
      physical_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    });

    await applyBridgeSandboxCustomerMockAddress('cust_1');

    expect(bridgeUpdateCustomer).not.toHaveBeenCalled();
  });

  it('forces PUT when force option is set', async () => {
    bridgeGetCustomer.mockResolvedValue({
      id: 'cust_1',
      type: 'business',
      physical_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    });

    await applyBridgeSandboxCustomerMockAddress('cust_1', { force: true });

    expect(bridgeUpdateCustomer).toHaveBeenCalled();
  });
});
