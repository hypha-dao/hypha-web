import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankTransferRailOption } from '../types';
import { BankOnboardingError } from './errors';
import { findBankCustomerByPersonAndProvider } from './queries';
import { getTransferRailOptionsForCustomer } from './get-transfer-rail-options-for-customer';

export async function getPersonalTransferRailOptions(
  person: { id: number },
  { db }: { db: DatabaseInstance },
): Promise<BankTransferRailOption[]> {
  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  return getTransferRailOptionsForCustomer(customer);
}
