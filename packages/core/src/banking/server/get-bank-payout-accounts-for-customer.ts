import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  bridgeListExternalAccounts,
  bridgeListLiquidationAddresses,
} from '../../common/server/bridge-client';
import type {
  BankPayoutAccountsListOptions,
  PaginatedBankPayoutAccounts,
} from '../types';
import { mapBridgePayoutAccountToPublic } from './map-bridge-resources';

/**
 * Owner-agnostic core: lists Bridge payout (liquidation) accounts for a resolved
 * bank customer. Space/person wrappers resolve their own customer first, then
 * delegate here. Returns empty when the customer or provider id is missing.
 */
export async function getBankPayoutAccountsForCustomer(
  customer: BankCustomer | null,
  input: BankPayoutAccountsListOptions,
): Promise<PaginatedBankPayoutAccounts> {
  if (!customer) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const limit = input.limit ?? 25;

  const [liquidationListed, externalListed] = await Promise.all([
    bridgeListLiquidationAddresses(customerId, {
      limit,
      starting_after: input.startingAfter,
    }),
    bridgeListExternalAccounts(customerId, { limit: 100 }),
  ]);

  const externalById = new Map(
    externalListed.data.map((account) => [account.id, account]),
  );

  const accounts = liquidationListed.data
    .filter((liquidation) => liquidation.external_account_id)
    .map((liquidation) =>
      mapBridgePayoutAccountToPublic({
        liquidationAddress: liquidation,
        externalAccount:
          (liquidation.external_account_id
            ? externalById.get(liquidation.external_account_id)
            : null) ?? null,
      }),
    );

  const last = liquidationListed.data.at(-1);

  return {
    accounts,
    hasMore: liquidationListed.has_more ?? false,
    nextCursor: liquidationListed.has_more && last ? last.id : null,
  };
}
