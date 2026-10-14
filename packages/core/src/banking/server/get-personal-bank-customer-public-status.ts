import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import {
  buildPublicStatusFromCustomer,
  getBankCustomerPublicStatuses,
  type BankProviderStatusEntry,
  type SpaceBankCustomerPublicStatus,
} from './get-space-bank-customer-public-status';
import {
  findBankCustomerByPersonAndProvider,
  findBankCustomersByPerson,
} from './queries';

/**
 * Public banking status for a person. Reuses the owner-agnostic
 * `buildPublicStatusFromCustomer`; the returned shape is provider-scoped, not
 * space-scoped, despite the (historical) type name.
 */
export async function getPersonalBankCustomerPublicStatus(
  person: { id: number },
  { db }: { db: DatabaseInstance },
): Promise<SpaceBankCustomerPublicStatus | null> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return null;
  }

  return buildPublicStatusFromCustomer(customer, { db });
}

/** Every provider's status for a person (D11) — one entry per `bank_customers` row (D3). */
export async function getPersonalBankCustomerPublicStatuses(
  person: { id: number },
  { db }: { db: DatabaseInstance },
): Promise<BankProviderStatusEntry[]> {
  const customers = await findBankCustomersByPerson(person.id, { db });
  return getBankCustomerPublicStatuses(customers, { db });
}
