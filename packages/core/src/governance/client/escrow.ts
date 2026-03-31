import type { Abi } from 'viem';

import { escrowImplementationAddress } from '@hypha-platform/core/generated';

import { getGovernanceChainId } from './governance-chain-id';

/** Minimal ABI for investment / escrow proposal encoding (EscrowImplementation). */
export const escrowImplementationAbi = [
  {
    type: 'function',
    name: 'createEscrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_partyB', type: 'address' },
      { name: '_tokenA', type: 'address' },
      { name: '_tokenB', type: 'address' },
      { name: '_amountA', type: 'uint256' },
      { name: '_amountB', type: 'uint256' },
      { name: '_sendFundsNow', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'receiveFunds',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_escrowId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getEscrow',
    stateMutability: 'view',
    inputs: [{ name: '_escrowId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'partyA', type: 'address' },
      { name: 'partyB', type: 'address' },
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'isPartyAFunded', type: 'bool' },
      { name: 'isPartyBFunded', type: 'bool' },
      { name: 'isCompleted', type: 'bool' },
      { name: 'isCancelled', type: 'bool' },
    ],
  },
] as const satisfies Abi;

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Resolves EscrowImplementation proxy: optional `NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS`
 * override, otherwise the address for the active governance chain from `escrowImplementationAddress`
 * (Base mainnet matches `packages/storage-evm/contracts/addresses.txt`).
 */
export function getEscrowImplementationAddress(): `0x${string}` | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS?.trim();
  if (v) {
    if (ADDR_RE.test(v)) return v as `0x${string}`;
    return undefined;
  }
  const chainId = getGovernanceChainId();
  const mapped = escrowImplementationAddress[chainId];
  return mapped as `0x${string}` | undefined;
}

export const HYPHA_INVESTMENT_FORM_START = '\n\n__hypha_investment__\n';
export const HYPHA_INVESTMENT_FORM_END = '\n__end_hypha_investment__\n';

export type HyphaInvestmentFormPayloadV1 = {
  version: 1;
  investorAddress: string;
  investorSendLegs: { amount: string; token: string }[];
  /** Investor receive leg (amount + token); optional legacy source for older markers. */
  spaceReceiveLegs?: {
    amount: string;
    token: string;
    source?: 'mint' | 'treasury';
  }[];
};

export function appendHyphaInvestmentFormMarker(
  description: string,
  payload: HyphaInvestmentFormPayloadV1,
): string {
  return (
    description +
    HYPHA_INVESTMENT_FORM_START +
    JSON.stringify(payload) +
    HYPHA_INVESTMENT_FORM_END
  );
}

export function parseHyphaInvestmentFormFromDescription(
  description: string | undefined | null,
): HyphaInvestmentFormPayloadV1 | null {
  if (!description) return null;
  const start = description.indexOf(HYPHA_INVESTMENT_FORM_START);
  const end = description.indexOf(HYPHA_INVESTMENT_FORM_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const json = description.slice(
    start + HYPHA_INVESTMENT_FORM_START.length,
    end,
  );
  try {
    const parsed = JSON.parse(json) as HyphaInvestmentFormPayloadV1;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Removes embedded investment JSON from proposal description for display.
 * Handles canonical markers and mangled text (e.g. markdown stripping `__` or newlines).
 */
export function stripHyphaInvestmentFormMarker(
  description: string | undefined | null,
): string {
  if (!description) return '';

  const endMarker = '__end_hypha_investment__';
  const endLen = endMarker.length;

  // 1) Canonical block
  const canonStart = description.indexOf(HYPHA_INVESTMENT_FORM_START);
  if (canonStart !== -1) {
    const canonEnd = description.indexOf(HYPHA_INVESTMENT_FORM_END, canonStart);
    if (canonEnd !== -1) {
      return (
        description.slice(0, canonStart) +
        description.slice(canonEnd + HYPHA_INVESTMENT_FORM_END.length)
      ).trimEnd();
    }
    return description.slice(0, canonStart).trimEnd();
  }

  // 2) End marker present — strip from payload (prefer JSON start; avoids matching
  //    "hypha_investment" inside user-authored description text)
  const endIdx = description.lastIndexOf(endMarker);
  if (endIdx !== -1) {
    const before = description.slice(0, endIdx);
    const jsonAt = before.search(/\{\s*"version"\s*:\s*1/);
    const tagged = before.lastIndexOf('__hypha_investment__');

    let blockStart = -1;
    if (jsonAt !== -1) blockStart = jsonAt;
    else if (tagged !== -1) blockStart = tagged;
    else {
      const looseHypha = before.search(/\bhypha_investment\b/);
      if (looseHypha !== -1) {
        const afterWord = before.slice(
          looseHypha + 'hypha_investment'.length,
        );
        if (/^\s*\{/.test(afterWord)) blockStart = looseHypha;
      }
    }

    if (blockStart !== -1) {
      let userEnd = blockStart;
      while (userEnd > 0 && /\s/.test(before[userEnd - 1]!)) {
        userEnd -= 1;
      }
      return (
        description.slice(0, userEnd) + description.slice(endIdx + endLen)
      ).trimEnd();
    }
  }

  return description;
}
