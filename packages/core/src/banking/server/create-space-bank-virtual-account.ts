import type { DatabaseInstance } from '../../common/server/types';
import {
  BRIDGE_DEFAULT_DESTINATION_CURRENCY,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';
import { DEFAULT_BANK_PROVIDER, getPaymentRailForCurrency } from '../constants';
import type {
  CreateSpaceBankVirtualAccountInput,
  CreateSpaceBankVirtualAccountResult,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  buildRailStatuses,
  loadBankingProviderState,
  resolveCustomerApproved,
  syncProviderCustomerIdFromKycLink,
  vaPairKey,
} from './providers/bridge/banking-provider-state';
import {
  getEndorsementForCurrency,
  isBridgeEndorsementApproved,
} from './bridge-customer-endorsements';
import { mapBridgeVirtualAccountToPublic } from './map-bridge-resources';
import { updateBankCustomer } from './mutations';
import { requireSpaceTreasuryAddress } from './require-space-treasury-address';

export type CreateSpaceBankVirtualAccountOptions = {
  kycProvider?: BankKycProvider;
};

export async function createSpaceBankVirtualAccount(
  input: CreateSpaceBankVirtualAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankVirtualAccountOptions,
): Promise<CreateSpaceBankVirtualAccountResult> {
  const { spaceSlug, authToken, currency } = input;
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

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({ space, authToken });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before opening bank accounts',
      404,
    );
  }

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      'Complete business verification before opening bank accounts',
      403,
    );
  }

  let customerId = customer.providerCustomerId;
  if (!customerId) {
    customerId = await syncProviderCustomerIdFromKycLink(customer);
    if (customerId) {
      await updateBankCustomer(
        { id: customer.id, providerCustomerId: customerId },
        { db },
      );
    }
  }

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

  const treasuryAddress = await requireSpaceTreasuryAddress(space);
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const created = await kycProvider.provisionVirtualAccount({
    customerId,
    currency,
    destinationAddress: treasuryAddress,
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
    treasuryAddress,
    paymentRail,
  );

  return { account };
}
