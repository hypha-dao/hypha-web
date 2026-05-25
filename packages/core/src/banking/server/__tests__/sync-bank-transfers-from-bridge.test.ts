import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const bridgeGetTransfer = vi.fn();
const findBankTransfersByCustomer = vi.fn();
const updateBankTransfer = vi.fn();

vi.mock('../../../common/server/bridge-client', () => ({
  bridgeGetTransfer: (...args: unknown[]) => bridgeGetTransfer(...args),
}));

vi.mock('../queries', () => ({
  findBankTransfersByCustomer: (...args: unknown[]) =>
    findBankTransfersByCustomer(...args),
}));

vi.mock('../mutations', () => ({
  updateBankTransfer: (...args: unknown[]) => updateBankTransfer(...args),
}));

import { syncBankTransfersFromBridge } from '../sync-bank-transfers-from-bridge';

const mockDb = {} as never;

const customer = { id: 10 };

describe('syncBankTransfersFromBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips transfers without a Bridge provider id', async () => {
    findBankTransfersByCustomer.mockResolvedValue([
      {
        id: 1,
        providerTransferId: null,
        status: 'pending_activation',
        depositMessage: null,
        depositInstructions: {},
      },
      {
        id: 2,
        providerTransferId: 'transfer_live',
        status: 'awaiting_funds',
        depositMessage: 'BRG7msg',
        depositInstructions: {},
      },
    ]);
    bridgeGetTransfer.mockResolvedValue({
      state: 'funds_received',
      source_deposit_instructions: {
        deposit_message: 'BRG7msg',
      },
    });
    updateBankTransfer.mockResolvedValue(undefined);

    const synced = await syncBankTransfersFromBridge(customer, { db: mockDb });

    expect(bridgeGetTransfer).toHaveBeenCalledTimes(1);
    expect(bridgeGetTransfer).toHaveBeenCalledWith('transfer_live');
    expect(synced).toBe(1);
    expect(updateBankTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        status: 'funds_received',
      }),
      { db: mockDb },
    );
  });

  it('fetches receipt for completed transfers missing stored receipt', async () => {
    findBankTransfersByCustomer.mockResolvedValue([
      {
        id: 3,
        providerTransferId: 'transfer_done',
        status: 'payment_processed',
        depositMessage: 'BRG7msg',
        depositInstructions: {},
      },
    ]);
    bridgeGetTransfer.mockResolvedValue({
      id: 'transfer_done',
      state: 'payment_processed',
      source_deposit_instructions: {
        deposit_message: 'BRG7msg',
        iban: 'DE89370400440532013000',
      },
      receipt: {
        final_amount: '500.25',
        destination_tx_hash: '0xdeadbeef',
      },
    });
    updateBankTransfer.mockResolvedValue(undefined);

    const synced = await syncBankTransfersFromBridge(customer, { db: mockDb });

    expect(synced).toBe(1);
    expect(updateBankTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        depositInstructions: expect.objectContaining({
          bridge_transfer_snapshot: expect.objectContaining({
            id: 'transfer_done',
            receipt: expect.objectContaining({
              final_amount: '500.25',
            }),
          }),
          iban: 'DE89370400440532013000',
        }),
      }),
      { db: mockDb },
    );
  });
});
