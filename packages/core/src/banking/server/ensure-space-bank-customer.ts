import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';

export type EnsureSpaceBankCustomerInput = {
  space: Space;
  authToken: string;
};

export type EnsureSpaceBankCustomerResult = {
  customer: BankCustomer;
  isApproved: boolean;
  procedures: Awaited<
    ReturnType<typeof buildPublicStatusFromCustomer>
  >['procedures'];
};

export async function ensureSpaceBankCustomer(
  input: EnsureSpaceBankCustomerInput,
  { db }: { db: DatabaseInstance },
): Promise<EnsureSpaceBankCustomerResult> {
  const auth = await authorizeSpaceBankOnboarding({
    space: input.space,
    authToken: input.authToken,
  });

  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: input.space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before using banking',
      404,
    );
  }

  const status = await buildPublicStatusFromCustomer(customer, { db });

  return {
    customer,
    isApproved: status.isApproved,
    procedures: status.procedures,
  };
}
