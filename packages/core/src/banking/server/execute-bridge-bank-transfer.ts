import { randomUUID } from 'node:crypto';

import { isBridgeSandboxApi } from '../../common/server/bridge-sandbox';
import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER, getTransferSourceRailForCurrency } from '../constants';
import { simulateBridgeKybData } from './simulate-bridge-kyb-data';
import { BankOnboardingError } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

function mapBridgeTransferError(error: unknown): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  if (status !== undefined && status >= 400 && status < 500) {
    console.error('Bridge transfer creation failed:', error);
    return new BankOnboardingError(
      'Could not create payment request for this currency. Complete KYB for this corridor or try another currency.',
      400,
    );
  }

  return null;
}

export type ExecuteBridgeBankTransferInput = {
  customer: BankCustomer;
  space: Pick<Space, 'address'>;
  currency: string;
  amount?: string;
};

export type ExecuteBridgeBankTransferResult = {
  providerTransferId: string;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string;
  depositInstructions: Record<string, unknown>;
  status: string;
};

export type ExecuteBridgeBankTransferOptions = {
  kycProvider?: BankKycProvider;
};

export async function executeBridgeBankTransfer(
  input: ExecuteBridgeBankTransferInput,
  { db }: { db: DatabaseInstance },
  options?: ExecuteBridgeBankTransferOptions,
): Promise<ExecuteBridgeBankTransferResult> {
  const { customer, space, currency, amount } = input;

  const paymentRail = getTransferSourceRailForCurrency(currency);
  if (!paymentRail) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

  if (!space.address) {
    throw new BankOnboardingError(
      'Space treasury address is required before creating payment requests',
      422,
    );
  }

  let resolvedCustomer = customer;

  if (resolvedCustomer.kycStatus !== 'approved') {
    const synced = await syncBankCustomerKycFromBridge(resolvedCustomer, { db });
    resolvedCustomer = synced.customer;
    if (!synced.isApproved) {
      throw new BankOnboardingError(
        'KYB is not yet approved. Complete verification first.',
        403,
      );
    }
  }

  let customerId = resolvedCustomer.providerCustomerId;
  if (!customerId) {
    const synced = await syncBankCustomerKycFromBridge(resolvedCustomer, { db });
    resolvedCustomer = synced.customer;
    customerId = resolvedCustomer.providerCustomerId ?? null;
  }

  if (!customerId) {
    throw new BankOnboardingError(
      'Bridge customer is not ready yet. Try again after KYB approval completes.',
      422,
    );
  }

  if (isBridgeSandboxApi()) {
    try {
      await simulateBridgeKybData(customerId, {
        businessLegalName: resolvedCustomer.name,
      });
    } catch (error) {
      const mapped = mapBridgeApiError(error, 'PUT /customers/{id}');
      if (mapped) {
        throw mapped;
      }
      throw error;
    }
  }

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  try {
    const created = await kycProvider.createTransfer({
      customerId,
      currency,
      paymentRail,
      destinationAddress: space.address,
      amount,
      idempotencyKey: randomUUID(),
    });

    return {
      providerTransferId: created.providerTransferId,
      currency: created.currency,
      paymentRail: created.paymentRail,
      amount: created.amount,
      depositMessage: created.depositMessage,
      depositInstructions: created.depositInstructions,
      status: created.status,
    };
  } catch (error) {
    const mapped = mapBridgeTransferError(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}
