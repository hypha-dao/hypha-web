import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import type {
  ListPersonalBankVirtualAccountsInput,
  PaginatedBankVirtualAccounts,
} from '../types';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getBankVirtualAccountsForCustomer } from './get-bank-virtual-accounts-for-customer';

export async function getPersonalBankVirtualAccounts(
  person: { id: number },
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

  const fullPerson = await findPersonBySlug({ slug: input.personSlug }, { db });
  const walletAddress = fullPerson?.address ?? null;

  return getBankVirtualAccountsForCustomer(customer, walletAddress, {
    limit: input.limit,
    startingAfter: input.startingAfter,
  });
}
