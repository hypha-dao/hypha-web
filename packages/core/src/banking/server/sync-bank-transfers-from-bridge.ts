import { bridgeGetTransfer } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  hasBridgeTransferSnapshot,
  mergeBridgeTransferSyncIntoInstructions,
} from '../bridge-transfer-receipt';
import { BANK_TRANSFER_TERMINAL_STATES } from '../constants';
import { updateBankTransfer } from './mutations';
import { findBankTransfersByCustomer } from './queries';

function isTerminalTransferStatus(status: string): boolean {
  return (BANK_TRANSFER_TERMINAL_STATES as readonly string[]).includes(status);
}

function shouldSyncTransferFromBridge(transfer: {
  status: string;
  providerTransferId: string | null;
  depositInstructions: Record<string, unknown>;
}): boolean {
  if (!transfer.providerTransferId) {
    return false;
  }

  if (!isTerminalTransferStatus(transfer.status)) {
    return true;
  }

  return (
    transfer.status === 'payment_processed' &&
    !hasBridgeTransferSnapshot(transfer.depositInstructions)
  );
}

export async function syncBankTransfersFromBridge(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<number> {
  const transfers = await findBankTransfersByCustomer(
    { bankCustomerId: customer.id },
    { db },
  );

  let synced = 0;

  for (const transfer of transfers) {
    if (!shouldSyncTransferFromBridge(transfer)) {
      continue;
    }

    try {
      const remote = await bridgeGetTransfer(transfer.providerTransferId!);
      const instructions = mergeBridgeTransferSyncIntoInstructions(
        remote.source_deposit_instructions,
        remote,
      );
      const depositMessage =
        typeof instructions.deposit_message === 'string'
          ? instructions.deposit_message
          : transfer.depositMessage;

      const snapshotChanged = !hasBridgeTransferSnapshot(
        transfer.depositInstructions,
      );

      if (
        remote.state !== transfer.status ||
        depositMessage !== transfer.depositMessage ||
        snapshotChanged
      ) {
        await updateBankTransfer(
          {
            id: transfer.id,
            status: remote.state,
            depositInstructions: instructions,
            depositMessage,
            destinationAddress:
              remote.destination?.to_address ?? transfer.destinationAddress,
          },
          { db },
        );
        synced += 1;
      }
    } catch (error) {
      console.error(
        `Bridge transfer sync failed for ${transfer.providerTransferId}:`,
        error,
      );
    }
  }

  return synced;
}
