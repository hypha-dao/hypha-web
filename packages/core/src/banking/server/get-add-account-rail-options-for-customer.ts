import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
} from '../bridge-destination-currencies';
import { BANK_VIRTUAL_ACCOUNT_CURRENCIES } from '../constants';
import type { BankAddAccountRailOption } from '../types';
import {
  buildRailStatuses,
  loadBankingProviderState,
} from './providers/bridge/banking-provider-state';

const sortOrder: Record<string, number> = {
  approved: 0,
  pending: 1,
  not_approved: 2,
  not_requested: 3,
  active: 4,
};

/**
 * Owner-agnostic core: resolves add-account (deposit corridor) options for an
 * already-resolved bank customer. Space/person wrappers resolve their own
 * customer first, then delegate here.
 */
export async function getAddAccountRailOptionsForCustomer(
  customer: BankCustomer,
): Promise<BankAddAccountRailOption[]> {
  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });

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
