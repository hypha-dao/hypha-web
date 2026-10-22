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
import { normalizeExecutorAddress } from './map-bridge-resources';

const MAX_ACCOUNT_PAGES = 8;

export async function getSpaceBankVirtualAccounts(
  space: Pick<Space, 'id' | 'web3SpaceId'> & { address?: string | null },
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

  let treasuryAddress: `0x${string}` | null = null;
  try {
    treasuryAddress = await resolveSpaceExecutorAddress(space);
  } catch (error) {
    console.error(
      'getSpaceBankVirtualAccounts: treasury lookup failed',
      error instanceof Error ? error.message : error,
    );
  }
  if (!treasuryAddress) {
    const stored = normalizeExecutorAddress(space.address);
    treasuryAddress = stored ? (stored as `0x${string}`) : null;
  }

  let startingAfter = input.startingAfter;
  let last: PaginatedBankVirtualAccounts = {
    accounts: [],
    hasMore: false,
    nextCursor: null,
  };
  const accounts: PaginatedBankVirtualAccounts['accounts'] = [];

  for (let page = 0; page < MAX_ACCOUNT_PAGES; page += 1) {
    last = await getBankVirtualAccountsForCustomer(customer, treasuryAddress, {
      limit: input.limit,
      startingAfter,
    });
    accounts.push(...last.accounts);
    if (
      !last.hasMore ||
      !last.nextCursor ||
      last.nextCursor === startingAfter
    ) {
      break;
    }
    startingAfter = last.nextCursor;
  }

  return {
    accounts,
    hasMore: last.hasMore,
    nextCursor: last.nextCursor,
  };
}
