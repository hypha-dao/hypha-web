import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type {
  CreateSpaceBankTransferResult,
  RequestSpaceBankTransferInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { requireSpaceTreasuryAddress } from './require-space-treasury-address';
import { createBankTransferForCustomer } from './create-bank-transfer-for-customer';

export async function createSpaceBankTransfer(
  input: RequestSpaceBankTransferInput,
  { db }: { db: DatabaseInstance },
): Promise<CreateSpaceBankTransferResult> {
  const { spaceSlug, authToken } = input;

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
      'Complete business verification before creating transfers',
      404,
    );
  }

  const treasuryAddress = await requireSpaceTreasuryAddress(space);

  return createBankTransferForCustomer(customer, input, treasuryAddress);
}
