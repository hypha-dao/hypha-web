import 'server-only';

import type {
  BankCustomer,
  BankVirtualAccount,
} from '@hypha-platform/storage-postgres';

import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_ACTIVATION,
  BANK_OPERATION_PENDING_KYB,
} from '../constants';
import {
  fetchBridgeCustomerEndorsementStatuses,
  getEndorsementForCurrency,
  isBridgeEndorsementApproved,
  resolveEndorsementStatusFromMap,
  type BridgeEndorsementStatusMap,
} from './bridge-customer-endorsements';
import { fetchBridgeKycLinkLive } from './fetch-bridge-kyc-link-live';
import { updateBankVirtualAccount } from './mutations';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

export type VirtualAccountEndorsementResolution = {
  isApproved: boolean;
  endorsementStatus: string | null;
};

async function resolveBridgeCustomerIdReadOnly(
  customer: Pick<BankCustomer, 'providerCustomerId' | 'providerKycLinkId'>,
): Promise<string | null> {
  if (customer.providerCustomerId) {
    return customer.providerCustomerId;
  }

  const live = await fetchBridgeKycLinkLive(customer);
  return live?.providerCustomerId ?? null;
}

async function resolveBridgeCustomerIdForWrite(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<string | null> {
  if (customer.providerCustomerId) {
    return customer.providerCustomerId;
  }

  const synced = await syncBankCustomerKycFromBridge(customer, { db });
  return synced.customer.providerCustomerId ?? null;
}

/** Read-only Bridge endorsement check — does not write to the database. */
export async function resolveVirtualAccountEndorsementFromBridge(
  account: BankVirtualAccount,
  customer: Pick<BankCustomer, 'providerCustomerId' | 'providerKycLinkId'>,
  prefetchedStatuses?: BridgeEndorsementStatusMap,
): Promise<VirtualAccountEndorsementResolution> {
  const endorsement = getEndorsementForCurrency(account.currency);

  if (account.providerVirtualAccountId || account.isApproved) {
    return {
      isApproved: true,
      endorsementStatus: 'approved',
    };
  }

  if (!endorsement) {
    return {
      isApproved: false,
      endorsementStatus: null,
    };
  }

  const customerId = await resolveBridgeCustomerIdReadOnly(customer);
  if (!customerId) {
    return {
      isApproved: false,
      endorsementStatus: null,
    };
  }

  const statusMap =
    prefetchedStatuses ??
    (await fetchBridgeCustomerEndorsementStatuses(customerId));
  const endorsementStatus = resolveEndorsementStatusFromMap(
    statusMap,
    endorsement,
  );

  return {
    isApproved: isBridgeEndorsementApproved(endorsementStatus),
    endorsementStatus,
  };
}

/**
 * Checks Bridge and persists account approval when the corridor is approved.
 * Intended for write paths such as account activation — not GET handlers.
 */
export async function persistVirtualAccountEndorsementFromBridge(
  account: BankVirtualAccount,
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
  prefetchedStatuses?: BridgeEndorsementStatusMap,
): Promise<{
  account: BankVirtualAccount;
  isApproved: boolean;
  endorsementStatus: string | null;
}> {
  if (account.providerVirtualAccountId || account.isApproved) {
    return {
      account,
      isApproved: true,
      endorsementStatus: 'approved',
    };
  }

  const endorsement = getEndorsementForCurrency(account.currency);
  if (!endorsement) {
    return {
      account,
      isApproved: false,
      endorsementStatus: null,
    };
  }

  const customerId = await resolveBridgeCustomerIdForWrite(customer, { db });
  if (!customerId) {
    return {
      account,
      isApproved: false,
      endorsementStatus: null,
    };
  }

  const statusMap =
    prefetchedStatuses ??
    (await fetchBridgeCustomerEndorsementStatuses(customerId));
  const endorsementStatus = resolveEndorsementStatusFromMap(
    statusMap,
    endorsement,
  );

  if (!isBridgeEndorsementApproved(endorsementStatus)) {
    return {
      account,
      isApproved: false,
      endorsementStatus,
    };
  }

  const patch: {
    isApproved: boolean;
    status?: string;
  } = { isApproved: true };

  if (account.status === BANK_OPERATION_PENDING_KYB) {
    patch.status = BANK_OPERATION_PENDING_ACTIVATION;
  }

  const updated = await updateBankVirtualAccount(
    {
      id: account.id,
      ...patch,
    },
    { db },
  );

  return {
    account: updated,
    isApproved: true,
    endorsementStatus,
  };
}
