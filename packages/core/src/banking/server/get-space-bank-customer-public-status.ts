import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

export type SpaceBankCustomerPublicStatus = {
  kycStatus: string;
  kycLink: string | null;
  tosLink: string | null;
  isApproved: boolean;
};

export async function getSpaceBankCustomerPublicStatus(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<SpaceBankCustomerPublicStatus | null> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return null;
  }

  let resolved = customer;

  if (customer.kycStatus !== 'approved') {
    try {
      const synced = await syncBankCustomerKycFromBridge(customer, { db });
      resolved = synced.customer;
    } catch (error) {
      console.error(
        'Bridge KYC sync failed while loading bank customer status:',
        error,
      );
    }
  }

  return {
    kycStatus: resolved.kycStatus,
    kycLink: resolved.kycLink,
    tosLink: resolved.tosLink,
    isApproved: resolved.kycStatus === 'approved',
  };
}
