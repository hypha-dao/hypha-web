import type { BridgeTransferResponse } from '../common/server/bridge-client';

export type BridgeTransferReceipt = {
  initial_amount?: string;
  developer_fee?: string;
  exchange_fee?: string;
  subtotal_amount?: string;
  gas_fee?: string;
  final_amount?: string;
  destination_tx_hash?: string;
  url?: string;
};

export type BridgeTransferSnapshot = {
  id?: string;
  state?: string;
  currency?: string;
  amount?: string;
  developer_fee?: string;
  source?: {
    payment_rail?: string;
    currency?: string;
  };
  destination?: {
    payment_rail?: string;
    currency?: string;
    to_address?: string;
  };
  receipt?: BridgeTransferReceipt;
  created_at?: string;
  updated_at?: string;
};

const RECEIPT_STORAGE_KEY = 'bridge_receipt';
const SNAPSHOT_STORAGE_KEY = 'bridge_transfer_snapshot';

export function readBridgeTransferReceipt(
  depositInstructions: Record<string, unknown>,
): BridgeTransferReceipt | null {
  const raw = depositInstructions[RECEIPT_STORAGE_KEY];
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const receipt: BridgeTransferReceipt = {};

  for (const key of [
    'initial_amount',
    'developer_fee',
    'exchange_fee',
    'subtotal_amount',
    'gas_fee',
    'final_amount',
    'destination_tx_hash',
    'url',
  ] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      receipt[key] = value.trim();
    }
  }

  return Object.keys(receipt).length > 0 ? receipt : null;
}

export function readBridgeTransferSnapshot(
  depositInstructions: Record<string, unknown>,
): BridgeTransferSnapshot | null {
  const raw = depositInstructions[SNAPSHOT_STORAGE_KEY];
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const readString = (key: string) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const readNested = (key: 'source' | 'destination') => {
    const value = record[key];
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const nested = value as Record<string, unknown>;
    const paymentRail =
      typeof nested.payment_rail === 'string' ? nested.payment_rail : undefined;
    const currency =
      typeof nested.currency === 'string' ? nested.currency : undefined;
    const toAddress =
      typeof nested.to_address === 'string' ? nested.to_address : undefined;
    if (!paymentRail && !currency && !toAddress) {
      return undefined;
    }
    return {
      payment_rail: paymentRail,
      currency,
      to_address: toAddress,
    };
  };

  const snapshot: BridgeTransferSnapshot = {
    id: readString('id'),
    state: readString('state'),
    currency: readString('currency'),
    amount: readString('amount'),
    developer_fee: readString('developer_fee'),
    source: readNested('source'),
    destination: readNested('destination'),
    created_at: readString('created_at'),
    updated_at: readString('updated_at'),
  };

  const receiptRaw = record.receipt;
  if (typeof receiptRaw === 'object' && receiptRaw !== null) {
    const receiptRecord = receiptRaw as Record<string, unknown>;
    const receipt: BridgeTransferReceipt = {};
    for (const key of [
      'initial_amount',
      'developer_fee',
      'exchange_fee',
      'subtotal_amount',
      'gas_fee',
      'final_amount',
      'destination_tx_hash',
      'url',
    ] as const) {
      const value = receiptRecord[key];
      if (typeof value === 'string' && value.trim()) {
        receipt[key] = value.trim();
      }
    }
    if (Object.keys(receipt).length > 0) {
      snapshot.receipt = receipt;
    }
  }

  return snapshot.id || snapshot.state || snapshot.receipt ? snapshot : null;
}

function buildSnapshotFromRemote(
  remote: BridgeTransferResponse,
): BridgeTransferSnapshot {
  return {
    id: remote.id,
    state: remote.state,
    currency:
      remote.currency ??
      remote.source?.currency ??
      remote.destination?.currency,
    amount: remote.amount ?? undefined,
    developer_fee: remote.developer_fee ?? remote.developer_fee_percent,
    source: remote.source
      ? {
          payment_rail: remote.source.payment_rail,
          currency: remote.source.currency,
        }
      : undefined,
    destination: remote.destination
      ? {
          payment_rail: remote.destination.payment_rail,
          currency: remote.destination.currency,
          to_address: remote.destination.to_address,
        }
      : undefined,
    receipt: remote.receipt,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
  };
}

export function mergeBridgeTransferSyncIntoInstructions(
  instructions: Record<string, unknown>,
  remote: Pick<
    BridgeTransferResponse,
    | 'id'
    | 'state'
    | 'amount'
    | 'developer_fee_percent'
    | 'source'
    | 'destination'
    | 'receipt'
    | 'created_at'
    | 'updated_at'
  >,
): Record<string, unknown> {
  const snapshot = buildSnapshotFromRemote(remote as BridgeTransferResponse);
  const next: Record<string, unknown> = {
    ...instructions,
    [SNAPSHOT_STORAGE_KEY]: snapshot,
  };

  if (remote.receipt && Object.keys(remote.receipt).length > 0) {
    next[RECEIPT_STORAGE_KEY] = remote.receipt;
  }

  return next;
}

/** @deprecated Use mergeBridgeTransferSyncIntoInstructions */
export function mergeBridgeTransferReceiptIntoInstructions(
  instructions: Record<string, unknown>,
  receipt: BridgeTransferReceipt | undefined,
): Record<string, unknown> {
  if (!receipt || Object.keys(receipt).length === 0) {
    return instructions;
  }

  return {
    ...instructions,
    [RECEIPT_STORAGE_KEY]: receipt,
  };
}

export function hasBridgeTransferReceipt(
  depositInstructions: Record<string, unknown>,
): boolean {
  return readBridgeTransferReceipt(depositInstructions) != null;
}

export function hasBridgeTransferSnapshot(
  depositInstructions: Record<string, unknown>,
): boolean {
  return readBridgeTransferSnapshot(depositInstructions) != null;
}
