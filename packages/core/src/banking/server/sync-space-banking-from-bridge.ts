import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { SyncSpaceBankingFromBridgeResult } from '../types';
import { getSpaceBankTransfers } from './get-space-bank-transfers';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';
import { promotePendingBankOperations } from './promote-pending-bank-operations';
import { syncBankTransfersFromBridge } from './sync-bank-transfers-from-bridge';

export async function syncSpaceBankingFromBridge(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<SyncSpaceBankingFromBridgeResult> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return {
      kycStatus: 'not_started',
      isApproved: false,
      transfersSynced: 0,
      transfers: [],
    };
  }

  const synced = await syncBankCustomerKycFromBridge(customer, { db });
  if (synced.isApproved) {
    await promotePendingBankOperations(synced.customer, { db });
  }
  const transfersSynced = await syncBankTransfersFromBridge(synced.customer, {
    db,
  });
  const transfers = await getSpaceBankTransfers(space, { db });

  return {
    kycStatus: synced.customer.kycStatus,
    isApproved: synced.isApproved,
    transfersSynced,
    transfers,
  };
}
