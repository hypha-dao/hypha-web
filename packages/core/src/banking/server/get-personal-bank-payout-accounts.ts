import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  ListPersonalBankPayoutAccountsInput,
  PaginatedBankPayoutAccounts,
} from '../types';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getBankPayoutAccountsForCustomer } from './get-bank-payout-accounts-for-customer';

export async function getPersonalBankPayoutAccounts(
  person: { id: number },
  input: ListPersonalBankPayoutAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankPayoutAccounts> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  return getBankPayoutAccountsForCustomer(customer, {
    limit: input.limit,
    startingAfter: input.startingAfter,
  });
}
