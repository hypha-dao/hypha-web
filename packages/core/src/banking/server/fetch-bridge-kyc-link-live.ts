import 'server-only';

import { bridgeGetKycLink } from '../../common/server/bridge-client';
import type { BankCustomer } from '@hypha-platform/storage-postgres';

export type BridgeKycLinkLiveSnapshot = {
  kycStatus: string;
  tosStatus: string | null;
  isKycApproved: boolean;
  isTosApproved: boolean;
  providerCustomerId: string | null;
};

export async function fetchBridgeKycLinkLive(
  customer: Pick<BankCustomer, 'providerKycLinkId'>,
): Promise<BridgeKycLinkLiveSnapshot | null> {
  if (!customer.providerKycLinkId) {
    return null;
  }

  const link = await bridgeGetKycLink(customer.providerKycLinkId);
  const tosStatus = link.tos_status ?? null;

  return {
    kycStatus: link.kyc_status,
    tosStatus,
    isKycApproved: link.kyc_status === 'approved',
    isTosApproved: tosStatus === 'approved',
    providerCustomerId: link.customer_id ?? null,
  };
}

/** True when Bridge indicates the user already completed that step (link should not be re-opened). */
export function isBridgeKycProcedureSubmitted(
  status: string | null | undefined,
): boolean {
  if (!status) {
    return false;
  }
  if (status === 'approved') {
    return true;
  }
  return (
    status === 'under_review' ||
    status.startsWith('awaiting_') ||
    status === 'paused'
  );
}

export function isBridgeTosProcedureSubmitted(
  status: string | null | undefined,
): boolean {
  return status === 'approved';
}
