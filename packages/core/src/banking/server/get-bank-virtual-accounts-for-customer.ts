import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { bridgeListVirtualAccounts } from '../../common/server/bridge-client';
import { getPaymentRailForCurrency } from '../constants';
import type { PaginatedBankVirtualAccounts } from '../types';
import {
  bridgeVirtualAccountTargetsSpace,
  mapBridgeVirtualAccountToPublic,
} from './map-bridge-resources';

export type BankVirtualAccountsListOptions = {
  limit?: number;
  startingAfter?: string;
};

/**
 * Owner-agnostic core: lists Bridge virtual accounts for a resolved bank
 * customer, scoped to a destination address. Space/person wrappers resolve
 * their own customer + destination address first, then delegate here.
 */
export async function getBankVirtualAccountsForCustomer(
  customer: BankCustomer | null,
  destinationAddress: string | null,
  input: BankVirtualAccountsListOptions,
): Promise<PaginatedBankVirtualAccounts> {
  if (!customer) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const listed = await bridgeListVirtualAccounts(customerId, {
    limit: input.limit ?? 25,
    starting_after: input.startingAfter,
  });

  const scoped = listed.data.filter((row) =>
    bridgeVirtualAccountTargetsSpace(row, destinationAddress),
  );

  const accounts = scoped.map((row) => {
    const currency =
      row.source?.currency ??
      (typeof row.source_deposit_instructions.currency === 'string'
        ? row.source_deposit_instructions.currency
        : 'unknown');
    const fallbackRail = getPaymentRailForCurrency(currency) ?? 'unknown';
    return mapBridgeVirtualAccountToPublic(
      row,
      destinationAddress ?? '',
      fallbackRail,
    );
  });

  const last = scoped.at(-1);

  return {
    accounts,
    hasMore: listed.has_more ?? false,
    nextCursor: listed.has_more && last ? last.id : null,
  };
}
