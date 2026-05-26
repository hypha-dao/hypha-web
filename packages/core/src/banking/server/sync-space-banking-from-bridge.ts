import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { SyncSpaceBankingFromBridgeResult } from '../types';
import { BankOnboardingError } from './errors';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { updateBankCustomer } from './mutations';
import { syncProviderCustomerIdFromKycLink } from './providers/bridge/banking-provider-state';

export async function syncSpaceBankingFromBridge(
  space: Pick<Space, 'id' | 'title'>,
  { db }: { db: DatabaseInstance },
): Promise<SyncSpaceBankingFromBridgeResult> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  const providerCustomerId = await syncProviderCustomerIdFromKycLink(customer);
  if (
    providerCustomerId &&
    providerCustomerId !== customer.providerCustomerId
  ) {
    await updateBankCustomer(
      { id: customer.id, providerCustomerId },
      { db },
    );
  }

  const status = await buildPublicStatusFromCustomer(
    providerCustomerId
      ? { ...customer, providerCustomerId }
      : customer,
    { db },
  );

  return {
    isApproved: status.isApproved,
    procedures: status.procedures,
    railStatuses: status.railStatuses,
  };
}
