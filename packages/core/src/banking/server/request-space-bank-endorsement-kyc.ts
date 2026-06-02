import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { RequestEndorsementKycInput } from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { requestBridgeEndorsementKycLink } from './request-bridge-endorsement-kyc-link';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';
export async function requestSpaceBankEndorsementKyc(
  input: RequestEndorsementKycInput,
  { db }: { db: DatabaseInstance },
): Promise<{
  status: Awaited<ReturnType<typeof buildPublicStatusFromCustomer>>;
  kycLinkUrl: string;
}> {
  const space = await findSpaceBySlug({ slug: input.spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({
    space,
    authToken: input.authToken,
  });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
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
