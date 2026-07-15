import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { Person } from '../../people/types';
import type {
  ListPersonalBankTransfersInput,
  PaginatedBankTransfers,
} from '../types';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getBankTransfersForCustomer } from './get-bank-transfers-for-customer';

export async function getPersonalBankTransfers(
  person: Pick<Person, 'id' | 'address'>,
  input: ListPersonalBankTransfersInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankTransfers> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer || !customer.providerCustomerId) {
    return { transfers: [], hasMore: false, nextCursor: null };
  }

  return getBankTransfersForCustomer(customer, person.address ?? null, {
    limit: input.limit,
    startingAfter: input.startingAfter,
    endingBefore: input.endingBefore,
  });
}
