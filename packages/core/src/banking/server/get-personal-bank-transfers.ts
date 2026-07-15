import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import type {
  ListPersonalBankTransfersInput,
  PaginatedBankTransfers,
} from '../types';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getBankTransfersForCustomer } from './get-bank-transfers-for-customer';

export async function getPersonalBankTransfers(
  person: { id: number },
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

  const fullPerson = await findPersonBySlug({ slug: input.personSlug }, { db });
  const walletAddress = fullPerson?.address ?? null;

  return getBankTransfersForCustomer(customer, walletAddress, {
    limit: input.limit,
    startingAfter: input.startingAfter,
    endingBefore: input.endingBefore,
  });
}
