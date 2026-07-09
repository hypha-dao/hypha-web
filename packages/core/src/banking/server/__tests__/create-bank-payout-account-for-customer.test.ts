import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  resolveCustomerApproved,
  loadBankingProviderState,
  laPairKey,
  mapBridgePayoutAccountToPublic,
} = vi.hoisted(() => ({
  resolveCustomerApproved: vi.fn(),
  loadBankingProviderState: vi.fn(),
  laPairKey: vi.fn(),
  mapBridgePayoutAccountToPublic: vi.fn(),
}));

vi.mock('../providers/bridge/banking-provider-state', () => ({
  resolveCustomerApproved: (...args: unknown[]) =>
    resolveCustomerApproved(...args),
  loadBankingProviderState: (...args: unknown[]) =>
    loadBankingProviderState(...args),
  laPairKey: (...args: unknown[]) => laPairKey(...args),
}));

vi.mock('../map-bridge-resources', () => ({
  mapBridgePayoutAccountToPublic: (...args: unknown[]) =>
    mapBridgePayoutAccountToPublic(...args),
}));

import { createBankPayoutAccountForCustomer } from '../create-bank-payout-account-for-customer';
import type { BankKycProvider } from '../providers/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import type { CreateBankPayoutAccountFields } from '../../types';

const customer = {
  id: 1,
  providerCustomerId: 'cust_1',
} as unknown as BankCustomer;

const input = {
  railKey: 'usd_ach',
  sourceCurrency: 'usdc',
  bankName: 'Test Bank',
  accountName: 'Checking',
  accountOwnerName: 'Alice Doe',
  routingNumber: '021000021',
  accountNumber: '1234567890',
  address: {
    street_line_1: '1 Main St',
    city: 'NYC',
    postal_code: '10001',
    country: 'USA',
  },
} as unknown as CreateBankPayoutAccountFields;

const mockProvider: BankKycProvider = {
  provider: 'bridge',
  provisionVirtualAccount: vi.fn(),
  createTransfer: vi.fn(),
  createKycLink: vi.fn(),
  registerExternalAccount: vi.fn().mockResolvedValue({
    providerExternalAccountId: 'ext_1',
    active: true,
    currency: 'usd',
    accountName: 'Checking',
    bankName: 'Test Bank',
    accountOwnerName: 'Alice Doe',
    accountLast4: '7890',
    checkingOrSavings: 'checking',
  }),
  createLiquidationAddress: vi.fn().mockResolvedValue({
    providerLiquidationAddressId: 'liq_1',
    sourceChain: 'base',
    sourceCurrency: 'usdc',
    evmAddress: '0xabc',
    destinationPaymentRail: 'ach',
    destinationCurrency: 'usd',
    state: 'active',
  }),
};

describe('createBankPayoutAccountForCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCustomerApproved.mockResolvedValue(true);
    loadBankingProviderState.mockResolvedValue({
      liquidationAddressPairs: new Set<string>(),
    });
    laPairKey.mockReturnValue('base:usdc:ext_1');
    mapBridgePayoutAccountToPublic.mockReturnValue({ id: 'liq_1' });
  });

  it('throws 403 with the default (space) message when not approved', async () => {
    resolveCustomerApproved.mockResolvedValue(false);

    await expect(
      createBankPayoutAccountForCustomer(customer, input, {
        kycProvider: mockProvider,
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Complete business verification before adding payout accounts',
    });
    expect(mockProvider.registerExternalAccount).not.toHaveBeenCalled();
  });

  it('throws 403 with a custom (personal) message when provided', async () => {
    resolveCustomerApproved.mockResolvedValue(false);

    await expect(
      createBankPayoutAccountForCustomer(customer, input, {
        kycProvider: mockProvider,
        notApprovedMessage:
          'Complete identity verification before adding payout accounts',
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Complete identity verification before adding payout accounts',
    });
  });

  it('throws 409 when a matching liquidation pair already exists', async () => {
    loadBankingProviderState.mockResolvedValue({
      liquidationAddressPairs: new Set<string>(['base:usdc:ext_1']),
    });

    await expect(
      createBankPayoutAccountForCustomer(customer, input, {
        kycProvider: mockProvider,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('registers the external account + liquidation address for an approved customer', async () => {
    const result = await createBankPayoutAccountForCustomer(customer, input, {
      kycProvider: mockProvider,
    });

    expect(mockProvider.registerExternalAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        railKey: 'usd_ach',
        idempotencyKey: expect.stringContaining('ea:cust_1:usd_ach:usdc:'),
      }),
    );
    expect(mockProvider.createLiquidationAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        externalAccountId: 'ext_1',
        sourceCurrency: 'usdc',
        destinationPaymentRail: 'ach',
      }),
    );
    expect(result).toEqual({ account: { id: 'liq_1' } });
  });
});
