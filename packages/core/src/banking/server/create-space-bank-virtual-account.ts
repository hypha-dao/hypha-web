import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  CreateSpaceBankVirtualAccountInput,
  CreateSpaceBankVirtualAccountResult,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import type { BankKycProvider } from './providers/types';
import { requireSpaceTreasuryAddress } from './require-space-treasury-address';
import { createBankVirtualAccountForCustomer } from './create-bank-virtual-account-for-customer';

export type CreateSpaceBankVirtualAccountOptions = {
  kycProvider?: BankKycProvider;
};

export async function createSpaceBankVirtualAccount(
  input: CreateSpaceBankVirtualAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankVirtualAccountOptions,
): Promise<CreateSpaceBankVirtualAccountResult> {
  const { spaceSlug, authToken, currency, destinationCurrency } = input;

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({ space, authToken });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before opening bank accounts',
      404,
    );
  }

  const treasuryAddress = await requireSpaceTreasuryAddress(space);

  return createBankVirtualAccountForCustomer(
    customer,
    { currency, destinationCurrency },
    treasuryAddress,
    options,
  );
}
