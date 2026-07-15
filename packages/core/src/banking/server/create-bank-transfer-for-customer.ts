import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  BRIDGE_DEFAULT_DESTINATION_CURRENCY,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';
import { resolveBankTransferCorridor } from '../constants';
import type { BankTransferPublic } from '../types';
import { BankOnboardingError } from './errors';
import { executeBridgeBankTransfer } from './execute-bridge-bank-transfer';
import { mapBridgeTransferToPublic } from './map-bridge-resources';
import {
  buildRailStatuses,
  loadBankingProviderState,
  resolveCustomerApproved,
} from './providers/bridge/banking-provider-state';
import { isBridgeEndorsementApproved } from './bridge-customer-endorsements';

export type CreateBankTransferForCustomerFields = {
  railKey?: string;
  corridorKey?: string;
  currency?: string;
  amount?: string;
  destinationCurrency?: string;
  idempotencyKey?: string;
};

export type CreateBankTransferForCustomerOptions = {
  /** 403 message when the customer isn't verified yet (owner-specific wording). */
  notApprovedMessage?: string;
};

const DEFAULT_NOT_APPROVED_MESSAGE =
  'Complete business verification before creating transfers';

/**
 * Owner-agnostic core: creates a one-time bank transfer (manual/ad-hoc deposit
 * instructions) for an already-resolved, verified bank customer at a given
 * destination address. Space/person wrappers handle lookup + authorization +
 * destination-address resolution, then delegate here.
 */
export async function createBankTransferForCustomer(
  customer: BankCustomer,
  input: CreateBankTransferForCustomerFields,
  destinationAddress: `0x${string}`,
  options?: CreateBankTransferForCustomerOptions,
): Promise<BankTransferPublic> {
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ??
    BRIDGE_DEFAULT_DESTINATION_CURRENCY;

  const corridor = resolveBankTransferCorridor({
    corridorKey: input.railKey ?? input.corridorKey,
    currency: input.currency,
  });
  if (!corridor) {
    throw new BankOnboardingError('Unsupported transfer rail', 400);
  }

  const { currency, paymentRail } = corridor;

  if (
    !isAllowedBridgeDestinationCurrency({
      sourceRail: paymentRail,
      destinationCurrency,
    })
  ) {
    throw new BankOnboardingError(
      'Destination currency is not supported for this corridor',
      400,
    );
  }

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      options?.notApprovedMessage ?? DEFAULT_NOT_APPROVED_MESSAGE,
      403,
    );
  }

  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });
  const rail = rails.find(
    (r) =>
      r.currency === currency.toLowerCase() &&
      r.paymentRail.toLowerCase() === paymentRail.toLowerCase(),
  );

  if (!rail || !isBridgeEndorsementApproved(rail.endorsementStatus)) {
    throw new BankOnboardingError(
      'This payment rail is not yet approved. Complete verification in Banking settings.',
      403,
    );
  }

  const bridgeResult = await executeBridgeBankTransfer({
    customer,
    destinationAddress,
    currency,
    paymentRail,
    destinationCurrency,
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
  });

  return mapBridgeTransferToPublic(
    {
      id: bridgeResult.providerTransferId,
      state: bridgeResult.status,
      amount: bridgeResult.amount,
      currency: bridgeResult.currency,
      source: {
        payment_rail: bridgeResult.paymentRail,
        currency: bridgeResult.currency,
      },
      source_deposit_instructions: bridgeResult.depositInstructions,
      destination: {
        to_address: bridgeResult.destinationAddress,
        payment_rail: 'base',
        currency: destinationCurrency,
      },
    },
    bridgeResult.destinationAddress,
  );
}
