import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  ListBankVirtualAccountsInput,
  PaginatedBankVirtualAccounts,
} from '../types';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { getBankVirtualAccountsForCustomer } from './get-bank-virtual-accounts-for-customer';

export async function getSpaceBankVirtualAccounts(
  space: Pick<Space, 'id' | 'web3SpaceId'>,
  input: ListBankVirtualAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankVirtualAccounts> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer || !customer.providerCustomerId) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  const treasuryAddress = await resolveSpaceExecutorAddress(space);

  return getBankVirtualAccountsForCustomer(customer, treasuryAddress, {
    limit: input.limit,
    startingAfter: input.startingAfter,
  });
}
