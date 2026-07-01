import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { bridgeListVirtualAccounts } from '../../common/server/bridge-client';
import { DEFAULT_BANK_PROVIDER, getPaymentRailForCurrency } from '../constants';
import type {
  ListBankVirtualAccountsInput,
  PaginatedBankVirtualAccounts,
} from '../types';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { findBankCustomerBySpaceAndProvider } from './queries';
import {
  bridgeVirtualAccountTargetsSpace,
  mapBridgeVirtualAccountToPublic,
} from './map-bridge-resources';

export async function getSpaceBankVirtualAccounts(
  space: Pick<Space, 'id' | 'web3SpaceId'>,
  input: ListBankVirtualAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankVirtualAccounts> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const treasuryAddress = await resolveSpaceExecutorAddress(space);
  const listed = await bridgeListVirtualAccounts(customerId, {
    limit: input.limit ?? 25,
    starting_after: input.startingAfter,
  });

  const scoped = listed.data.filter((row) =>
    bridgeVirtualAccountTargetsSpace(row, treasuryAddress),
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
      treasuryAddress ?? '',
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
