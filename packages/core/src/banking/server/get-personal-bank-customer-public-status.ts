import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import {
  buildPublicStatusFromCustomer,
  type SpaceBankCustomerPublicStatus,
} from './get-space-bank-customer-public-status';
import { findBankCustomerByPersonAndProvider } from './queries';

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
