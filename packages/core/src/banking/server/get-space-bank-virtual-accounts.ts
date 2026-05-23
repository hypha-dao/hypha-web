import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankVirtualAccountPublic } from '../types';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';
import {
  findBankCustomerBySpaceAndProvider,
  findBankVirtualAccountsByCustomer,
} from './queries';

export async function getSpaceBankVirtualAccounts(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<BankVirtualAccountPublic[]> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return [];
  }

  const accounts = await findBankVirtualAccountsByCustomer(
    { bankCustomerId: customer.id },
    { db },
  );

  return accounts.map((row) => mapBankVirtualAccountToPublic(row));
}
