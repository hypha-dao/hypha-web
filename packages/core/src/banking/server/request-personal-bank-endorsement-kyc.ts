import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { RequestPersonalEndorsementKycInput } from '../types';
import { findPersonBySlug } from '../../people/server/queries';
import { BankOnboardingError } from './errors';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { findBankCustomerByPersonAndProvider } from './queries';
import { requestBridgeEndorsementKycLink } from './request-bridge-endorsement-kyc-link';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';

export async function requestPersonalBankEndorsementKyc(
  input: RequestPersonalEndorsementKycInput,
  { db }: { db: DatabaseInstance },
): Promise<{
  status: Awaited<ReturnType<typeof buildPublicStatusFromCustomer>>;
  kycLinkUrl: string;
}> {
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
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  const endorsement = input.endorsement.trim();
  if (!endorsement) {
    throw new BankOnboardingError('endorsement is required', 400);
  }

  const { customer: updated, kycLinkUrl } =
    await requestBridgeEndorsementKycLink(customer, endorsement, { db });

  const status = await buildPublicStatusFromCustomer(updated, { db });
  return { status, kycLinkUrl };
}
