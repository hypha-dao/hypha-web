import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_KYB,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  currenciesToEndorsements,
  DEFAULT_BANK_PROVIDER,
  getPaymentRailForCurrency,
  type BankVirtualAccountCurrency,
} from '../constants';
import type {
  BankVirtualAccountPublic,
  RequestSpaceBankVirtualAccountsInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { ensureSpaceBankCustomer } from './ensure-space-bank-customer';
import { provisionSpaceBankVirtualAccount } from './provision-space-bank-virtual-account';
import { insertBankVirtualAccount } from './mutations';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';
import type { BankKycProvider } from './providers/types';
import { promotePendingBankOperations } from './promote-pending-bank-operations';
import { resolveBridgeKycEndorsements } from './providers/bridge/endorsements';
import { findBankVirtualAccountByCorridorAndCustomer } from './queries';

export type RequestSpaceBankVirtualAccountsOptions = {
  kycProvider?: BankKycProvider;
};

export async function requestSpaceBankVirtualAccounts(
  input: RequestSpaceBankVirtualAccountsInput,
  { db }: { db: DatabaseInstance },
  options?: RequestSpaceBankVirtualAccountsOptions,
): Promise<BankVirtualAccountPublic[]> {
  const { spaceSlug, authToken, currencies } = input;

  const normalized = currencies.filter((c) =>
    (BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(c),
  ) as BankVirtualAccountCurrency[];

  if (normalized.length === 0) {
    throw new BankOnboardingError('Select at least one currency', 400);
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const endorsements = resolveBridgeKycEndorsements(
    input.endorsements ?? currenciesToEndorsements(normalized),
  );

  console.log('[banking] requestSpaceBankVirtualAccounts endorsements', {
    spaceSlug,
    currencies: normalized,
    endorsements,
  });

  const ensured = await ensureSpaceBankCustomer(
    {
      space,
      authToken,
      legalName: input.legalName,
      contactEmail: input.contactEmail,
      endorsements,
      redirectUri: input.redirectUri,
    },
    { db },
    options,
  );

  const customer = ensured.customer;
  if (ensured.isApproved) {
    await promotePendingBankOperations(customer, { db });
  }

  const isApproved = customer.kycStatus === 'approved';
  const results: BankVirtualAccountPublic[] = [];

  for (const currency of normalized) {
    const paymentRail = getPaymentRailForCurrency(currency);
    if (!paymentRail) {
      continue;
    }

    const existing = await findBankVirtualAccountByCorridorAndCustomer(
      {
        bankCustomerId: customer.id,
        currency,
        paymentRail,
      },
      { db },
    );

    if (existing) {
      results.push(mapBankVirtualAccountToPublic(existing));
      continue;
    }

    if (!isApproved) {
      const inserted = await insertBankVirtualAccount(
        {
          bankCustomerId: customer.id,
          provider: DEFAULT_BANK_PROVIDER,
          providerVirtualAccountId: null,
          currency,
          paymentRail,
          depositInstructions: {},
          destinationAddress: space.address ?? '',
          status: BANK_OPERATION_PENDING_KYB,
        },
        { db },
      );
      results.push(mapBankVirtualAccountToPublic(inserted));
      continue;
    }

    const provisioned = await provisionSpaceBankVirtualAccount(
      { spaceSlug, authToken, currency },
      { db },
      options,
    );

    results.push(provisioned);
  }

  return results;
}
