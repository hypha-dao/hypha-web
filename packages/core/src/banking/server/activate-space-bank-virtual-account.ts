import type { DatabaseInstance } from '../../common/server/types';
import type { BankVirtualAccountPublic } from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { provisionSpaceBankVirtualAccount } from './provision-space-bank-virtual-account';
import type { BankKycProvider } from './providers/types';
import {
  findBankCustomerBySpaceAndProvider,
  findBankVirtualAccountById,
} from './queries';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';

export type ActivateSpaceBankVirtualAccountInput = {
  spaceSlug: string;
  authToken: string;
  accountId: number;
};

export async function activateSpaceBankVirtualAccount(
  input: ActivateSpaceBankVirtualAccountInput,
  { db }: { db: DatabaseInstance },
  options?: { kycProvider?: BankKycProvider },
): Promise<BankVirtualAccountPublic> {
  const space = await findSpaceBySlug({ slug: input.spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  const account = await findBankVirtualAccountById(
    { id: input.accountId, bankCustomerId: customer.id },
    { db },
  );
  if (!account) {
    throw new BankOnboardingError('Bank account not found', 404);
  }

  if (account.providerVirtualAccountId) {
    return mapBankVirtualAccountToPublic(account, true);
  }

  const result = await provisionSpaceBankVirtualAccount(
    {
      spaceSlug: input.spaceSlug,
      authToken: input.authToken,
      currency: account.currency,
    },
    { db },
    options,
  );

  return result;
}
