import { decodeErrorResult } from 'viem/utils';

/** Solidity `Error(string)` selector. */
export const ERROR_STRING_SELECTOR = '0x08c379a0';

/** RegularSpaceToken mutual-credit shortfall. */
export const CREDIT_LIMIT_REVERT_REASONS = [
  '!credit',
  'Insufficient credit',
] as const;

export type TransferRevertKind =
  | 'credit_limit'
  | 'sender_not_whitelisted'
  | 'recipient_not_whitelisted'
  | 'supply_exceeded'
  | 'transfer_helper_token'
  | 'unknown';

export type ChainRevertInfo = {
  /** First 4 bytes of revert data, e.g. `0x08c379a0`. */
  selector: string | null;
  /** Decoded `Error(string)` reason, or a best-effort extracted string. */
  reason: string | null;
  /** viem `shortMessage` when present. */
  shortMessage: string | null;
  /** Full error message / stringified error. */
  raw: string;
  kind: TransferRevertKind;
};

export function decodeRevertReason(hexReason: any): string | null {
  try {
    const decoded = decodeErrorResult({
      data: hexReason,
      abi: [
        {
          type: 'error',
          name: 'Error',
          inputs: [{ type: 'string' }],
        },
      ],
    });
    return decoded.args[0];
  } catch {
    return null;
  }
}

function collectHexCandidates(error: any): string[] {
  const candidates: string[] = [];
  const push = (value: unknown) => {
    if (
      typeof value === 'string' &&
      value.startsWith('0x') &&
      value.length >= 10
    ) {
      candidates.push(value);
    }
  };

  push(error?.data);
  push(error?.cause?.data);
  push(error?.cause?.cause?.data);
  try {
    push(typeof error?.walk === 'function' ? error.walk()?.data : undefined);
  } catch {
    // viem `walk` is optional; ignore if the error object is not a viem error.
  }

  const errorString =
    typeof error === 'string' ? error : error?.toString?.() || '';
  const hexMatches = errorString.match(/0x[0-9a-fA-F]+/g) ?? [];
  hexMatches.forEach(push);

  if (typeof error?.message === 'string') {
    const messageMatches = error.message.match(/0x[0-9a-fA-F]+/g) ?? [];
    messageMatches.forEach(push);
  }

  return [...new Set(candidates)];
}

export function classifyTransferRevertReason(
  reason: string | null | undefined,
): TransferRevertKind {
  if (!reason) return 'unknown';
  if (CREDIT_LIMIT_REVERT_REASONS.some((known) => reason.includes(known))) {
    return 'credit_limit';
  }
  if (reason.includes('Sender not whitelisted to transfer')) {
    return 'sender_not_whitelisted';
  }
  if (reason.includes('Recipient not whitelisted to receive')) {
    return 'recipient_not_whitelisted';
  }
  if (reason.includes('supply exceeded')) {
    return 'supply_exceeded';
  }
  if (reason.includes('TransferHelper: token not whitelisted')) {
    return 'transfer_helper_token';
  }
  return 'unknown';
}

export function extractRevertReason(error: any): string {
  const inspected = inspectChainRevert(error);
  return inspected.reason || error?.message || inspected.raw;
}

/**
 * Pull selector + decoded reason out of a viem / RPC transfer failure so
 * callers can log the **actual** chain revert instead of a mapped UX string.
 */
export function inspectChainRevert(error: any): ChainRevertInfo {
  const raw =
    typeof error === 'string'
      ? error
      : error?.message || error?.toString?.() || String(error);
  const shortMessage =
    typeof error?.shortMessage === 'string' ? error.shortMessage : null;

  let selector: string | null = null;
  let reason: string | null = null;

  for (const hex of collectHexCandidates(error)) {
    if (!selector) {
      selector = hex.slice(0, 10);
    }
    if (hex.startsWith(ERROR_STRING_SELECTOR)) {
      const decoded = decodeRevertReason(hex);
      if (decoded) {
        selector = ERROR_STRING_SELECTOR;
        reason = decoded;
        break;
      }
    }
  }

  if (!reason) {
    const executionMatch = raw.match(
      /Execution reverted with reason:\s*(.*?)\./,
    );
    if (executionMatch?.[1]) {
      reason = executionMatch[1];
    } else if (error?.reason && typeof error.reason === 'string') {
      reason = error.reason;
    }
  }

  const kind = classifyTransferRevertReason(reason ?? raw);

  return {
    selector,
    reason,
    shortMessage,
    raw,
    kind,
  };
}

export function logChainTransferError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): ChainRevertInfo {
  const inspected = inspectChainRevert(error);
  console.error(context, {
    selector: inspected.selector,
    reason: inspected.reason,
    kind: inspected.kind,
    shortMessage: inspected.shortMessage,
    raw: inspected.raw,
    ...extra,
  });
  return inspected;
}
