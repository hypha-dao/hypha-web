import 'server-only';

import {
  bridgeGetCustomer,
  type BridgeAssociatedPerson,
  type BridgeCustomerEndorsement,
} from '../../common/server/bridge-client';
import { type BankPendingUbo } from '../types';
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

export type CustomerMissingFlags = {
  sofMissing: boolean;
  pendingUbos: BankPendingUbo[];
};

/**
 * Parses all endorsements' requirements.missing.all_of to surface:
 * - whether the source_of_funds_questionnaire / minimal_source_of_funds_data is missing
 * - which associated persons (UBOs) still have pending requirements
 */
export function extractCustomerMissingFlags(
  endorsements: BridgeCustomerEndorsement[] | null | undefined,
  associatedPersons: BridgeAssociatedPerson[] | null | undefined,
): CustomerMissingFlags {
  if (!endorsements?.length) {
    return { sofMissing: false, pendingUbos: [] };
  }

  let sofMissing = false;
  const pendingUboIdSet = new Set<string>();

  for (const endorsement of endorsements) {
    const allOf = endorsement.requirements?.missing?.all_of;
    if (!Array.isArray(allOf)) {
      continue;
    }

    for (const item of allOf) {
      if (typeof item === 'string') {
        if (
          item === 'source_of_funds_questionnaire' ||
          item === 'minimal_source_of_funds_data'
        ) {
          sofMissing = true;
        }
      } else if (
        typeof item === 'object' &&
        item !== null &&
        item.object_type === 'associated_person' &&
        typeof item.object_id === 'string'
      ) {
        pendingUboIdSet.add(item.object_id);
      }
    }
  }

  const pendingUbos: BankPendingUbo[] = [...pendingUboIdSet].map((id) => {
    const person = associatedPersons?.find((p) => p.id === id);
    return { id, email: person?.email ?? null };
  });

  return { sofMissing, pendingUbos };
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
