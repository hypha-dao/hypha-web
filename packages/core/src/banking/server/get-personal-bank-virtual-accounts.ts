import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { Person } from '../../people/types';
import type {
  ListPersonalBankVirtualAccountsInput,
  PaginatedBankVirtualAccounts,
} from '../types';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getBankVirtualAccountsForCustomer } from './get-bank-virtual-accounts-for-customer';

export async function getPersonalBankVirtualAccounts(
  person: Pick<Person, 'id' | 'address'>,
  input: ListPersonalBankVirtualAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankVirtualAccounts> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer || !customer.providerCustomerId) {
    return { accounts: [], hasMore: false, nextCursor: null };
  }

  return getBankVirtualAccountsForCustomer(customer, person.address ?? null, {
    limit: input.limit,
    startingAfter: input.startingAfter,
  });
}
