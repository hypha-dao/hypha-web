import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import type { Space } from '../../space/types';
import {
  BRIDGE_DEFAULT_DESTINATION_CURRENCY,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { BankOnboardingError } from './errors';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { enrichBridgeDepositInstructions } from './enrich-bridge-deposit-instructions';
import { requireSpaceTreasuryAddress } from './require-space-treasury-address';
import { resolveCustomerApproved } from './providers/bridge/banking-provider-state';

function mapBridgeTransferError(error: unknown): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  if (status !== undefined && status >= 400 && status < 500) {
    console.error(
      'Bridge transfer creation failed:',
      error instanceof Error ? error.message : error,
    );
    return new BankOnboardingError(
      'Could not create payment request for this currency. Complete KYB for this rail or try another currency.',
      400,
    );
  }

  return null;
}

export type ExecuteBridgeBankTransferInput = {
  customer: BankCustomer;
  space: Pick<Space, 'web3SpaceId' | 'title'>;
  currency: string;
  paymentRail: string;
  destinationCurrency?: string;
  amount?: string;
  /** Client-supplied idempotency key; falls back to a random UUID. */
  idempotencyKey?: string;
};

export type ExecuteBridgeBankTransferResult = {
  providerTransferId: string;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string;
  depositInstructions: Record<string, unknown>;
  status: string;
  destinationAddress: string;
};

export type ExecuteBridgeBankTransferOptions = {
  kycProvider?: BankKycProvider;
};

export async function executeBridgeBankTransfer(
  input: ExecuteBridgeBankTransferInput,
  { db }: { db: DatabaseInstance },
  options?: ExecuteBridgeBankTransferOptions,
): Promise<ExecuteBridgeBankTransferResult> {
  const { customer, space, currency, paymentRail, amount } = input;
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ??
    BRIDGE_DEFAULT_DESTINATION_CURRENCY;

  if (!paymentRail.trim()) {
    throw new BankOnboardingError('Unsupported payment rail', 400);
  }

  if (
    !isAllowedBridgeDestinationCurrency({
      sourceRail: paymentRail,
      destinationCurrency,
    })
  ) {
    throw new BankOnboardingError(
      'Destination currency is not supported for this rail',
      400,
    );
  }

  const treasuryAddress = await requireSpaceTreasuryAddress(space);

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      'KYB is not yet approved. Complete verification first.',
      403,
    );
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    throw new BankOnboardingError(
      'Bridge customer is not ready yet. Try again after KYB approval completes.',
      422,
    );
  }

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  try {
    const created = await kycProvider.createTransfer({
      customerId,
      currency,
      paymentRail,
      destinationAddress: treasuryAddress,
      destinationCurrency,
      amount,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    });

    return {
      providerTransferId: created.providerTransferId,
      currency: created.currency,
      paymentRail: created.paymentRail,
      amount: created.amount,
      depositMessage: created.depositMessage,
      depositInstructions: enrichBridgeDepositInstructions(
        created.depositInstructions,
        {
          developerFeePercent: created.developerFeePercent,
          destination: created.destination,
        },
      ),
      status: created.status,
      destinationAddress: created.destination?.address ?? treasuryAddress,
    };
  } catch (error) {
    const mapped = mapBridgeTransferError(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}
