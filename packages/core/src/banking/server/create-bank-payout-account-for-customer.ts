import { createHash } from 'node:crypto';

import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  BRIDGE_LIQUIDATION_SOURCE_CHAIN,
  DEFAULT_BANK_PROVIDER,
  resolveBankPayoutRail,
} from '../constants';
import type {
  CreateBankPayoutAccountFields,
  CreateSpaceBankPayoutAccountResult,
} from '../types';
import { BankOnboardingError } from './errors';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  laPairKey,
  loadBankingProviderState,
  resolveCustomerApproved,
} from './providers/bridge/banking-provider-state';
import { mapBridgePayoutAccountToPublic } from './map-bridge-resources';

export type CreateBankPayoutAccountForCustomerOptions = {
  kycProvider?: BankKycProvider;
  /** 403 message when the customer isn't verified yet (owner-specific wording). */
  notApprovedMessage?: string;
  /** 422 message when the provider customer id isn't ready yet. */
  notReadyMessage?: string;
};

/** Default (space) wording — kept identical so space behavior is unchanged. */
const DEFAULT_NOT_APPROVED_MESSAGE =
  'Complete business verification before adding payout accounts';
const DEFAULT_NOT_READY_MESSAGE =
  'Bridge customer is not ready yet. Try again after KYB approval completes.';

/**
 * Owner-agnostic core: registers a Bridge external account + liquidation address
 * for an already-resolved, verified bank customer. Space/person wrappers handle
 * lookup + authorization, then delegate here.
 */
export async function createBankPayoutAccountForCustomer(
  customer: BankCustomer,
  input: CreateBankPayoutAccountFields,
  options?: CreateBankPayoutAccountForCustomerOptions,
): Promise<CreateSpaceBankPayoutAccountResult> {
  const rail = resolveBankPayoutRail(input.railKey);
  if (!rail) {
    throw new BankOnboardingError('Unsupported payout rail', 400);
  }

  const sourceCurrency = input.sourceCurrency.toLowerCase();
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ?? rail.destinationCurrency;

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      options?.notApprovedMessage ?? DEFAULT_NOT_APPROVED_MESSAGE,
      403,
    );
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    throw new BankOnboardingError(
      options?.notReadyMessage ?? DEFAULT_NOT_READY_MESSAGE,
      422,
    );
  }

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const idempotencyFingerprint = createHash('sha256')
    .update(
      [
        input.accountNumber ?? '',
        input.iban ?? '',
        input.routingNumber ?? '',
        input.sortCode ?? '',
      ]
        .join('|')
        .toLowerCase(),
    )
    .digest('hex');
  const externalAccountIdempotencyKey = `ea:${customerId}:${input.railKey}:${sourceCurrency}:${idempotencyFingerprint}`;

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
