import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import type {
  CreatePersonalBankPayoutAccountInput,
  CreatePersonalBankPayoutAccountResult,
} from '../types';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { BankOnboardingError } from './errors';
import { findBankCustomerByPersonAndProvider } from './queries';
import type { BankKycProvider } from './providers/types';
import { createBankPayoutAccountForCustomer } from './create-bank-payout-account-for-customer';

export type CreatePersonalBankPayoutAccountOptions = {
  kycProvider?: BankKycProvider;
};

const PERSONAL_NOT_APPROVED_MESSAGE =
  'Complete identity verification before adding payout accounts';

export async function createPersonalBankPayoutAccount(
  input: CreatePersonalBankPayoutAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreatePersonalBankPayoutAccountOptions,
): Promise<CreatePersonalBankPayoutAccountResult> {
  const person = await findPersonBySlug({ slug: input.personSlug }, { db });
  if (!person) {
    throw new BankOnboardingError('Person not found', 404);
  }

  const auth = await authorizePersonalBankOnboarding({
    person: { id: person.id },
    authToken: input.authToken,
  });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(PERSONAL_NOT_APPROVED_MESSAGE, 404);
  }

  return createBankPayoutAccountForCustomer(customer, input, {
    ...options,
    notApprovedMessage: PERSONAL_NOT_APPROVED_MESSAGE,
  });
}
