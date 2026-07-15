import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankAddAccountRailOption } from '../types';
import { BankOnboardingError } from './errors';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getAddAccountRailOptionsForCustomer } from './get-add-account-rail-options-for-customer';

export async function getPersonalAddAccountRailOptions(
  person: { id: number },
  { db }: { db: DatabaseInstance },
): Promise<BankAddAccountRailOption[]> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  return getAddAccountRailOptionsForCustomer(customer);
}
