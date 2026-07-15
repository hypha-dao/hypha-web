import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  BRIDGE_DEFAULT_DESTINATION_CURRENCY,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';
import { DEFAULT_BANK_PROVIDER, getPaymentRailForCurrency } from '../constants';
import type { BankVirtualAccountPublic } from '../types';
import { BankOnboardingError } from './errors';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  buildRailStatuses,
  loadBankingProviderState,
  resolveCustomerApproved,
  vaPairKey,
} from './providers/bridge/banking-provider-state';
import {
  getEndorsementForCurrency,
  isBridgeEndorsementApproved,
} from './bridge-customer-endorsements';
import { mapBridgeVirtualAccountToPublic } from './map-bridge-resources';

export type CreateBankVirtualAccountForCustomerFields = {
  currency: string;
  destinationCurrency?: string;
};

export type CreateBankVirtualAccountForCustomerOptions = {
  kycProvider?: BankKycProvider;
  /** 403 message when the customer isn't verified yet (owner-specific wording). */
  notApprovedMessage?: string;
};

const DEFAULT_NOT_APPROVED_MESSAGE =
  'Complete business verification before opening bank accounts';

/**
 * Owner-agnostic core: provisions a Bridge Virtual Account for an
 * already-resolved, verified bank customer at a given destination address.
 * Space/person wrappers handle lookup + authorization + destination-address
 * resolution, then delegate here.
 */
export async function createBankVirtualAccountForCustomer(
  customer: BankCustomer,
  input: CreateBankVirtualAccountForCustomerFields,
  destinationAddress: `0x${string}`,
  options?: CreateBankVirtualAccountForCustomerOptions,
): Promise<{ account: BankVirtualAccountPublic }> {
  const { currency } = input;
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ??
    BRIDGE_DEFAULT_DESTINATION_CURRENCY;

  const paymentRail = getPaymentRailForCurrency(currency);
  if (!paymentRail) {
    throw new BankOnboardingError('Unsupported currency', 400);
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

  const endorsement = getEndorsementForCurrency(currency);
  if (!endorsement) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      options?.notApprovedMessage ?? DEFAULT_NOT_APPROVED_MESSAGE,
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

  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });
  const rail = rails.find((r) => r.currency === currency.toLowerCase());
  if (!rail || !isBridgeEndorsementApproved(rail.endorsementStatus)) {
    throw new BankOnboardingError(
      'This currency is not yet approved. Complete verification for this rail in Banking settings.',
      403,
    );
  }

  if (state.virtualAccountPairs.has(vaPairKey(currency, destinationCurrency))) {
    throw new BankOnboardingError(
      'A bank account already exists for this currency and destination currency',
      409,
    );
  }

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const created = await kycProvider.provisionVirtualAccount({
    customerId,
    currency,
    destinationAddress,
    destinationCurrency,
    // Deterministic per logical account (one VA per customer+currency+destination,
    // enforced by virtualAccountPairs above) so a retry/double-click dedupes at
    // Bridge instead of provisioning a duplicate account.
    idempotencyKey: `va:${customerId}:${currency.toLowerCase()}:${destinationCurrency}`,
  });

  const account = mapBridgeVirtualAccountToPublic(
    {
      id: created.providerVirtualAccountId,
      status: created.status,
      source_deposit_instructions: created.depositInstructions,
      destination: created.destination,
      developer_fee_percent: created.developerFeePercent ?? undefined,
      source: { currency: created.currency, payment_rail: created.paymentRail },
    },
    destinationAddress,
    paymentRail,
  );

  return { account };
}
