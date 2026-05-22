import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankVirtualAccountPublic } from '../types';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';
import { resolveCustomerApprovedForOperations } from './resolve-customer-approved-for-operations';
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

  const isApproved = await resolveCustomerApprovedForOperations(customer);

  return accounts.map((row) => mapBankVirtualAccountToPublic(row, isApproved));
}
