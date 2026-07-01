import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import {
  bridgeListExternalAccounts,
  bridgeListLiquidationAddresses,
} from '../../common/server/bridge-client';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  ListBankPayoutAccountsInput,
  PaginatedBankPayoutAccounts,
} from '../types';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { mapBridgePayoutAccountToPublic } from './map-bridge-resources';

export async function getSpaceBankPayoutAccounts(
  space: Pick<Space, 'id'>,
  input: ListBankPayoutAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankPayoutAccounts> {
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
