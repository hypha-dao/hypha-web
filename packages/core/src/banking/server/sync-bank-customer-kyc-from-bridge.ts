import { bridgeGetKycLink } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { updateBankCustomer } from './mutations';

export type SyncBankCustomerKycResult = {
  customer: BankCustomer;
  isApproved: boolean;
};

/**
 * Live KYB check against Bridge when DB is not yet approved.
 * Persists customer_id and approved status when Bridge confirms.
 */
export async function syncBankCustomerKycFromBridge(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<SyncBankCustomerKycResult> {
  const link = await bridgeGetKycLink(customer.providerKycLinkId);

  const patch: {
    kycStatus?: string;
    providerCustomerId?: string | null;
  } = {};

  if (link.customer_id && !customer.providerCustomerId) {
    patch.providerCustomerId = link.customer_id;
  }

  if (link.kyc_status === 'approved' && customer.kycStatus !== 'approved') {
    patch.kycStatus = 'approved';
  }

  if (patch.kycStatus !== undefined || patch.providerCustomerId !== undefined) {
    const updated = await updateBankCustomer(
      {
        id: customer.id,
        ...patch,
      },
      { db },
    );
    return {
      customer: updated,
      isApproved: updated.kycStatus === 'approved',
    };
  }

  return {
    customer,
    isApproved: customer.kycStatus === 'approved',
  };
}
