import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import {
  BANK_TRANSFER_TERMINAL_STATES,
  DEFAULT_BANK_PROVIDER,
} from '../constants';
import { hasBridgeTransferSnapshot } from '../bridge-transfer-receipt';
import type { BankTransferPublic } from '../types';
import { mapBankTransferToPublic } from './map-bank-transfer-public';
import { resolveCustomerApprovedForOperations } from './resolve-customer-approved-for-operations';
import {
  findBankCustomerBySpaceAndProvider,
  findBankTransfersByCustomer,
} from './queries';
import { syncBankTransfersFromBridge } from './sync-bank-transfers-from-bridge';

function transferNeedsBridgeRefresh(
  transfer: Awaited<ReturnType<typeof findBankTransfersByCustomer>>[number],
): boolean {
  if (!transfer.providerTransferId) {
    return false;
  }

  if (
    !(BANK_TRANSFER_TERMINAL_STATES as readonly string[]).includes(
      transfer.status,
    )
  ) {
    return true;
  }

  return (
    transfer.status === 'payment_processed' &&
    !hasBridgeTransferSnapshot(transfer.depositInstructions)
  );
}

export async function getSpaceBankTransfers(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<BankTransferPublic[]> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return [];
  }

  const isApproved = await resolveCustomerApprovedForOperations(customer);

  let transfers = await findBankTransfersByCustomer(
    { bankCustomerId: customer.id },
    { db },
  );

  if (transfers.some(transferNeedsBridgeRefresh)) {
    await syncBankTransfersFromBridge(customer, { db });
    transfers = await findBankTransfersByCustomer(
      { bankCustomerId: customer.id },
      { db },
    );
  }

  return transfers
    .map((row) => mapBankTransferToPublic(row, isApproved))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
