import { bridgeGetTransfer } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { BANK_TRANSFER_TERMINAL_STATES } from '../constants';
import { updateBankTransfer } from './mutations';
import { findBankTransfersByCustomer } from './queries';

function isTerminalTransferStatus(status: string): boolean {
  return (BANK_TRANSFER_TERMINAL_STATES as readonly string[]).includes(status);
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
    if (isTerminalTransferStatus(transfer.status)) {
      continue;
    }

    try {
      const remote = await bridgeGetTransfer(transfer.providerTransferId);
      const instructions = remote.source_deposit_instructions;
      const depositMessage =
        typeof instructions.deposit_message === 'string'
          ? instructions.deposit_message
          : transfer.depositMessage;

      if (
        remote.state !== transfer.status ||
        depositMessage !== transfer.depositMessage
      ) {
        await updateBankTransfer(
          {
            id: transfer.id,
            status: remote.state,
            depositInstructions: instructions,
            depositMessage,
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
