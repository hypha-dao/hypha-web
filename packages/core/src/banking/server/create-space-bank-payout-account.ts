import type { DatabaseInstance } from '../../common/server/types';
import {
  BRIDGE_LIQUIDATION_SOURCE_CHAIN,
  DEFAULT_BANK_PROVIDER,
  resolveBankPayoutRail,
} from '../constants';
import type {
  CreateSpaceBankPayoutAccountInput,
  CreateSpaceBankPayoutAccountResult,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  laPairKey,
  loadBankingProviderState,
  resolveCustomerApproved,
  syncProviderCustomerIdFromKycLink,
} from './providers/bridge/banking-provider-state';
import { mapBridgePayoutAccountToPublic } from './map-bridge-resources';
import { updateBankCustomer } from './mutations';

export type CreateSpaceBankPayoutAccountOptions = {
  kycProvider?: BankKycProvider;
};

export async function createSpaceBankPayoutAccount(
  input: CreateSpaceBankPayoutAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankPayoutAccountOptions,
): Promise<CreateSpaceBankPayoutAccountResult> {
  const rail = resolveBankPayoutRail(input.railKey);
  if (!rail) {
    throw new BankOnboardingError('Unsupported payout rail', 400);
  }

  const sourceCurrency = input.sourceCurrency.toLowerCase();
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ?? rail.destinationCurrency;

  const space = await findSpaceBySlug({ slug: input.spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({
    space,
    authToken: input.authToken,
  });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before adding payout accounts',
      404,
    );
  }

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      'Complete business verification before adding payout accounts',
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

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const externalAccountIdempotencyKey = `ea:${customerId}:${
    input.railKey
  }:${sourceCurrency}:${
    input.accountNumber ?? input.iban ?? input.routingNumber ?? 'unknown'
  }`;

  const externalAccount = await kycProvider.registerExternalAccount({
    customerId,
    railKey: input.railKey,
    bankName: input.bankName,
    accountName: input.accountName,
    accountOwnerName: input.accountOwnerName,
    accountOwnerType: input.accountOwnerType,
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    routingNumber: input.routingNumber,
    accountNumber: input.accountNumber,
    checkingOrSavings: input.checkingOrSavings,
    iban: input.iban,
    bic: input.bic,
    sortCode: input.sortCode,
    destinationCurrency,
    swiftAccountFormat: input.swiftAccountFormat,
    swiftIbanCountry: input.swiftIbanCountry,
    swiftBankAddress: input.swiftBankAddress,
    swiftCategory: input.swiftCategory,
    swiftPurposeOfFunds: input.swiftPurposeOfFunds,
    swiftBusinessDescription: input.swiftBusinessDescription,
    address: input.address,
    idempotencyKey: externalAccountIdempotencyKey,
  });

  const state = await loadBankingProviderState(customer);
  const pairKey = laPairKey(
    BRIDGE_LIQUIDATION_SOURCE_CHAIN,
    sourceCurrency,
    externalAccount.providerExternalAccountId,
  );

  if (state.liquidationAddressPairs.has(pairKey)) {
    throw new BankOnboardingError(
      'A payout account already exists for this bank account and source currency',
      409,
    );
  }

  const liquidation = await kycProvider.createLiquidationAddress({
    customerId,
    externalAccountId: externalAccount.providerExternalAccountId,
    sourceCurrency,
    destinationPaymentRail: rail.destinationPaymentRail,
    destinationCurrency,
    wireMessage: input.wireMessage,
    idempotencyKey: `la:${customerId}:${externalAccount.providerExternalAccountId}:${BRIDGE_LIQUIDATION_SOURCE_CHAIN}:${sourceCurrency}`,
  });

  const account = mapBridgePayoutAccountToPublic({
    liquidationAddress: {
      id: liquidation.providerLiquidationAddressId,
      chain: liquidation.sourceChain,
      currency: liquidation.sourceCurrency,
      address: liquidation.evmAddress,
      external_account_id: externalAccount.providerExternalAccountId,
      destination_payment_rail: liquidation.destinationPaymentRail,
      destination_currency: liquidation.destinationCurrency,
      state: liquidation.state,
    },
    externalAccount: {
      id: externalAccount.providerExternalAccountId,
      active: externalAccount.active,
      currency: externalAccount.currency,
      account_name: externalAccount.accountName ?? undefined,
      bank_name: externalAccount.bankName ?? undefined,
      account_owner_name: externalAccount.accountOwnerName ?? undefined,
      last_4: externalAccount.accountLast4 ?? undefined,
      account:
        externalAccount.accountLast4 || externalAccount.checkingOrSavings
          ? {
              last_4: externalAccount.accountLast4 ?? undefined,
              checking_or_savings:
                externalAccount.checkingOrSavings ?? undefined,
            }
          : undefined,
    },
  });

  return { account };
}
