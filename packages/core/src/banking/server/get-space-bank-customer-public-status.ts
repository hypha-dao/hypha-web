import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findBankCustomerBySpaceAndProvider } from './queries';

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

  return {
    kycStatus: customer.kycStatus,
    kycLink: customer.kycLink,
    tosLink: customer.tosLink,
    isApproved: customer.kycStatus === 'approved',
  };
}
