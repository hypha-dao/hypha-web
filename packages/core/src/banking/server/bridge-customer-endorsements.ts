import 'server-only';

import {
  bridgeGetCustomer,
  type BridgeCustomerEndorsement,
} from '../../common/server/bridge-client';
import {
  BANK_CURRENCY_TO_ENDORSEMENT,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  type BankVirtualAccountCurrency,
} from '../constants';

export type BridgeEndorsementStatusMap = Map<string, string>;

export function getEndorsementForCurrency(currency: string): string | null {
  if (
    !(BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(currency)
  ) {
    return null;
  }
  return BANK_CURRENCY_TO_ENDORSEMENT[currency as BankVirtualAccountCurrency];
}

export function isBridgeEndorsementApproved(status: string | null): boolean {
  return status === 'approved';
}

export function parseBridgeCustomerEndorsements(
  endorsements: BridgeCustomerEndorsement[] | undefined,
): BridgeEndorsementStatusMap {
  const map: BridgeEndorsementStatusMap = new Map();
  for (const entry of endorsements ?? []) {
    if (typeof entry.name === 'string' && typeof entry.status === 'string') {
      map.set(entry.name, entry.status);
    }
  }
  return map;
}

export async function fetchBridgeCustomerEndorsementStatuses(
  customerId: string,
): Promise<BridgeEndorsementStatusMap> {
  const customer = await bridgeGetCustomer(customerId);
  return parseBridgeCustomerEndorsements(customer.endorsements);
}

export function resolveEndorsementStatusFromMap(
  map: BridgeEndorsementStatusMap,
  endorsement: string,
): string | null {
  return map.get(endorsement) ?? null;
}
