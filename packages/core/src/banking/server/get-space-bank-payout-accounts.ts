import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  ListBankPayoutAccountsInput,
  PaginatedBankPayoutAccounts,
} from '../types';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { getBankPayoutAccountsForCustomer } from './get-bank-payout-accounts-for-customer';

export async function getSpaceBankPayoutAccounts(
  space: Pick<Space, 'id'>,
  input: ListBankPayoutAccountsInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankPayoutAccounts> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  return getBankPayoutAccountsForCustomer(customer, {
    limit: input.limit,
    startingAfter: input.startingAfter,
  });
}
