import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_KYB,
  DEFAULT_BANK_PROVIDER,
  getPaymentRailForCurrency,
} from '../constants';
import type {
  BankVirtualAccountPublic,
  CreateSpaceBankVirtualAccountInput,
  CreateSpaceBankVirtualAccountResult,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { insertBankVirtualAccount } from './mutations';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';
import { provisionSpaceBankVirtualAccount } from './provision-space-bank-virtual-account';
import { getEndorsementForCurrency } from './bridge-customer-endorsements';
import type { BankKycProvider } from './providers/types';
import {
  findBankCustomerBySpaceAndProvider,
  findBankVirtualAccountByCorridorAndCustomer,
} from './queries';
import { requestBridgeEndorsementKycLink } from './request-bridge-endorsement-kyc-link';
import { persistVirtualAccountEndorsementFromBridge } from './sync-bank-virtual-account-endorsement';

export type CreateSpaceBankVirtualAccountOptions = {
  kycProvider?: BankKycProvider;
};

/**
 * Creates (or resumes) a space bank deposit account for one currency corridor.
 * Checks Bridge endorsement, requests endorsement-specific KYC when needed,
 * otherwise provisions the virtual account.
 */
export async function createSpaceBankVirtualAccount(
  input: CreateSpaceBankVirtualAccountInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankVirtualAccountOptions,
): Promise<CreateSpaceBankVirtualAccountResult> {
  const { spaceSlug, authToken, currency } = input;

  const paymentRail = getPaymentRailForCurrency(currency);
  if (!paymentRail) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

  const endorsement = getEndorsementForCurrency(currency);
  if (!endorsement) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({ space, authToken });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  let customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before opening bank accounts',
      404,
    );
  }

  let account = await findBankVirtualAccountByCorridorAndCustomer(
    {
      bankCustomerId: customer.id,
      currency,
      paymentRail,
    },
    { db },
  );

  if (account?.providerVirtualAccountId) {
    return {
      action: 'already_active',
      account: mapBankVirtualAccountToPublic(account),
    };
  }

  if (!account) {
    const treasuryAddress = (await resolveSpaceExecutorAddress(space)) ?? '';
    account = await insertBankVirtualAccount(
      {
        bankCustomerId: customer.id,
        provider: DEFAULT_BANK_PROVIDER,
        providerVirtualAccountId: null,
        currency,
        paymentRail,
        depositInstructions: {},
        destinationAddress: treasuryAddress,
        status: BANK_OPERATION_PENDING_KYB,
      },
      { db },
    );
  }

  const persisted = await persistVirtualAccountEndorsementFromBridge(
    account,
    customer,
    { db },
  );
  account = persisted.account;

  if (!persisted.isApproved) {
    customer = await requestBridgeEndorsementKycLink(customer, endorsement, {
      db,
    });

    return {
      action: 'kyc_required',
      currency,
      account: mapBankVirtualAccountToPublic(account),
      kycLink: customer.kycLink,
      tosLink: customer.tosLink,
    };
  }

  const provisioned = await provisionSpaceBankVirtualAccount(
    { spaceSlug, authToken, currency },
    { db },
    options,
  );

  return {
    action: 'provisioned',
    account: provisioned,
  };
}
