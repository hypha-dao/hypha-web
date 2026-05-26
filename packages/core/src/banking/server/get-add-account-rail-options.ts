import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
} from '../bridge-destination-currencies';
import {
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  DEFAULT_BANK_PROVIDER,
} from '../constants';
import type { BankAddAccountRailOption } from '../types';
import { BankOnboardingError } from './errors';
import { findBankCustomerBySpaceAndProvider } from './queries';
import {
  buildRailStatuses,
  loadBankingProviderState,
} from './providers/bridge/banking-provider-state';

export async function getAddAccountRailOptions(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<BankAddAccountRailOption[]> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });

  const sortOrder: Record<string, number> = {
    approved: 0,
    pending: 1,
    not_approved: 2,
    not_requested: 3,
    active: 4,
  };

  return rails
    .filter(
      (rail) =>
        // Virtual accounts are keyed by source currency (usd, eur, …), not transfer corridors (usd-ach, usd-wire).
        (BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(
          rail.railKey,
        ) && !rail.hasVirtualAccount,
    )
    .map((rail) => ({
      railKey: rail.railKey,
      currency: rail.currency,
      paymentRail: rail.paymentRail,
      endorsement: rail.endorsement,
      operationalStatus: rail.operationalStatus,
      validation: rail.validation,
      hasVirtualAccount: rail.hasVirtualAccount,
      destinationCurrencies: [
        ...getDestinationCurrenciesForSourceRail(rail.paymentRail),
      ],
      defaultDestinationCurrency: getDefaultDestinationCurrency({
        sourceCurrency: rail.currency,
        sourceRail: rail.paymentRail,
      }),
    }))
    .sort(
      (a, b) =>
        (sortOrder[a.operationalStatus] ?? 99) -
        (sortOrder[b.operationalStatus] ?? 99),
    );
}
