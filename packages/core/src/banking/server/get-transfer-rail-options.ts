import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import {
  BANK_TRANSFER_CORRIDOR_KEYS,
  BANK_TRANSFER_CORRIDORS,
  DEFAULT_BANK_PROVIDER,
  type BankTransferCorridorKey,
} from '../constants';
import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
} from '../bridge-destination-currencies';
import type { BankTransferRailOption } from '../types';
import { BankOnboardingError } from './errors';
import { findBankCustomerBySpaceAndProvider } from './queries';
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

export async function getTransferRailOptions(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<BankTransferRailOption[]> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

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
