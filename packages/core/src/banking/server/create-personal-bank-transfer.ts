import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import type {
  CreatePersonalBankTransferResult,
  RequestPersonalBankTransferInput,
} from '../types';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { BankOnboardingError } from './errors';
import { findBankCustomerByPersonAndProvider } from './queries';
import { requirePersonWalletAddress } from './require-person-wallet-address';
import { createBankTransferForCustomer } from './create-bank-transfer-for-customer';

const PERSONAL_NOT_APPROVED_MESSAGE =
  'Complete identity verification before creating transfers';

export async function createPersonalBankTransfer(
  input: RequestPersonalBankTransferInput,
  { db }: { db: DatabaseInstance },
): Promise<CreatePersonalBankTransferResult> {
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

  const walletAddress = await requirePersonWalletAddress(person);

  return createBankTransferForCustomer(customer, input, walletAddress, {
    notApprovedMessage: PERSONAL_NOT_APPROVED_MESSAGE,
  });
}
