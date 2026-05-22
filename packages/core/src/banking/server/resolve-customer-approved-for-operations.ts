import 'server-only';

import type { BankCustomer } from '@hypha-platform/storage-postgres';

import { fetchBridgeKycLinkLive } from './fetch-bridge-kyc-link-live';

/**
 * Read-only: true when DB or Bridge KYC link reports approved.
 * Does not persist to the database (use syncBankCustomerKycFromBridge on writes).
 */
export async function resolveCustomerApprovedForOperations(
  customer: BankCustomer,
): Promise<boolean> {
  if (customer.kycStatus === 'approved') {
    return true;
  }

  try {
    const live = await fetchBridgeKycLinkLive(customer);
    return live?.isKycApproved ?? false;
  } catch (error) {
    console.error('Bridge KYC live check failed:', error);
    return false;
  }
}
