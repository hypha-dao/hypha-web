import 'server-only';

import type {
  BridgeCreateVirtualAccountResponse,
  BridgeTransferResponse,
} from '../../common/server/bridge-client';
import { enrichBridgeDepositInstructions } from './enrich-bridge-deposit-instructions';
import type { BankTransferPublic, BankVirtualAccountPublic } from '../types';

export function normalizeExecutorAddress(
  address: string | null | undefined,
): string | null {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }
  return address.toLowerCase();
}

/** Bridge lists transfers per customer; scope to this Hypha space via treasury destination. */
export function bridgeTransferTargetsSpace(
  transfer: BridgeTransferResponse,
  treasuryAddress: string | null,
): boolean {
  const expected = normalizeExecutorAddress(treasuryAddress);
  if (!expected) {
    return false;
  }
  return (
    normalizeExecutorAddress(transfer.destination?.to_address) === expected
  );
}

export function bridgeVirtualAccountTargetsSpace(
  account: BridgeCreateVirtualAccountResponse,
  treasuryAddress: string | null,
): boolean {
  const expected = normalizeExecutorAddress(treasuryAddress);
  if (!expected) {
    return false;
  }
  return normalizeExecutorAddress(account.destination?.address) === expected;
}

function readDepositMessage(
  instructions: Record<string, unknown>,
): string | null {
  for (const key of ['deposit_message', 'message', 'reference']) {
    const value = instructions[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function resolveVirtualAccountCurrency(
  response: BridgeCreateVirtualAccountResponse,
): string {
  const fromSource = response.source?.currency;
  if (typeof fromSource === 'string') {
    return fromSource.toLowerCase();
  }

  const instructions = response.source_deposit_instructions;
  const fromInstructions = instructions.currency;
  if (typeof fromInstructions === 'string') {
    return fromInstructions.toLowerCase();
  }

  return 'unknown';
}

function resolveVirtualAccountRail(
  response: BridgeCreateVirtualAccountResponse,
  fallbackRail: string,
): string {
  const fromSource = response.source?.payment_rail;
  if (typeof fromSource === 'string') {
    return fromSource;
  }

  const instructions = response.source_deposit_instructions;
  const paymentRails = instructions.payment_rails;
  if (Array.isArray(paymentRails) && typeof paymentRails[0] === 'string') {
    return paymentRails[0];
  }

  return fallbackRail;
}

export function mapBridgeVirtualAccountToPublic(
  response: BridgeCreateVirtualAccountResponse,
  destinationAddress: string,
  fallbackRail: string,
): BankVirtualAccountPublic {
  const currency = resolveVirtualAccountCurrency(response);
  const paymentRail = resolveVirtualAccountRail(response, fallbackRail);
  const enriched = enrichBridgeDepositInstructions(
    response.source_deposit_instructions,
    {
      developerFeePercent: response.developer_fee_percent ?? null,
      destination: response.destination
        ? {
            currency: response.destination.currency ?? 'usdc',
            paymentRail: response.destination.payment_rail ?? 'base',
          }
        : null,
    },
  );

  return {
    id: response.id,
    currency,
    paymentRail,
    depositInstructions: enriched,
    destinationAddress: response.destination?.address ?? destinationAddress,
    status: response.status,
    createdAt: null,
  };
}

export function mapBridgeTransferToPublic(
  response: BridgeTransferResponse,
  destinationAddress: string,
): BankTransferPublic {
  const currency =
    response.currency?.toLowerCase() ??
    response.source?.currency?.toLowerCase() ??
    'unknown';
  const paymentRail = response.source?.payment_rail ?? 'unknown';
  const enriched = enrichBridgeDepositInstructions(
    response.source_deposit_instructions,
    {
      // Fixed-amount transfers report `developer_fee` (an amount, always "0.0"
      // for Hypha); flexible transfers report `developer_fee_percent`. Surface
      // whichever is present so the fee shows (e.g. "0.0%") instead of
      // "Not specified by provider".
      developerFeePercent:
        response.developer_fee_percent ?? response.developer_fee ?? null,
      destination: response.destination
        ? {
            currency: response.destination.currency ?? 'usdc',
            paymentRail: response.destination.payment_rail ?? 'base',
          }
        : null,
    },
  );

  if (response.receipt) {
    enriched.bridge_receipt = response.receipt;
  }

  return {
    id: response.id,
    currency,
    paymentRail,
    amount: response.amount ?? null,
    depositMessage: readDepositMessage(enriched),
    status: response.state,
    depositInstructions: enriched,
    destinationAddress: response.destination?.to_address ?? destinationAddress,
    createdAt: response.created_at ?? new Date().toISOString(),
  };
}
