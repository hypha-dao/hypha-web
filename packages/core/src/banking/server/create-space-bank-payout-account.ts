import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  CreateSpaceBankPayoutAccountInput,
  CreateSpaceBankPayoutAccountResult,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import type { BankKycProvider } from './providers/types';
import { createBankPayoutAccountForCustomer } from './create-bank-payout-account-for-customer';

export type CreateSpaceBankPayoutAccountOptions = {
  kycProvider?: BankKycProvider;
};

export async function createSpaceBankPayoutAccount(
  input: CreateSpaceBankPayoutAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankPayoutAccountOptions,
): Promise<CreateSpaceBankPayoutAccountResult> {
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
    throw new BankOnboardingError(
      'Complete business verification before adding payout accounts',
      404,
    );
  }

  return createBankPayoutAccountForCustomer(customer, input, options);
}
