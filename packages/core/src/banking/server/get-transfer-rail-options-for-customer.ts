import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  BANK_TRANSFER_CORRIDOR_KEYS,
  BANK_TRANSFER_CORRIDORS,
  type BankTransferCorridorKey,
} from '../constants';
import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
} from '../bridge-destination-currencies';
import type { BankTransferRailOption } from '../types';
import {
  buildRailStatuses,
  loadBankingProviderState,
} from './providers/bridge/banking-provider-state';

const SORT_ORDER: Record<string, number> = {
  approved: 0,
  active: 0,
  pending: 1,
  not_approved: 2,
  not_requested: 3,
};

/**
 * Owner-agnostic core: resolves transfer corridor options for an
 * already-resolved bank customer. Space/person wrappers resolve their own
 * customer first, then delegate here.
 */
export async function getTransferRailOptionsForCustomer(
  customer: BankCustomer,
): Promise<BankTransferRailOption[]> {
  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });
  const byCorridor = new Map(
    rails
      .filter((rail) =>
        (BANK_TRANSFER_CORRIDOR_KEYS as readonly string[]).includes(
          rail.railKey,
        ),
      )
      .map((rail) => [rail.railKey, rail]),
  );

  return (BANK_TRANSFER_CORRIDOR_KEYS as readonly BankTransferCorridorKey[])
    .map((corridorKey): BankTransferRailOption | null => {
      const corridor = BANK_TRANSFER_CORRIDORS[corridorKey];
      const rail = byCorridor.get(corridorKey);
      if (!rail) {
        return null;
      }

      return {
        railKey: corridorKey,
        currency: corridor.currency,
        paymentRail: corridor.paymentRail,
        endorsement: rail.endorsement,
        operationalStatus: rail.operationalStatus,
        validation: rail.validation,
        destinationCurrencies: [
          ...getDestinationCurrenciesForSourceRail(corridor.paymentRail),
        ],
        defaultDestinationCurrency: getDefaultDestinationCurrency({
          sourceCurrency: corridor.currency,
          sourceRail: corridor.paymentRail,
        }),
      };
    })
    .filter((option): option is BankTransferRailOption => option != null)
    .sort(
      (a, b) =>
        (SORT_ORDER[a.operationalStatus] ?? 99) -
        (SORT_ORDER[b.operationalStatus] ?? 99),
    );
}
