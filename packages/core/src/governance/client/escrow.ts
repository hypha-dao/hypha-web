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
      { name: '_partyA', type: 'address' },
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
    name: 'escrowCounter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'cancelEscrow',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_escrowId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'withdrawFromCancelled',
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
  // Events — kept in the same ABI so callers can decode receipt logs without
  // a second import. Mirrors `interfaces/IEscrow.sol`.
  {
    type: 'event',
    name: 'EscrowCreated',
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: true, name: 'partyA', type: 'address' },
      { indexed: false, name: 'partyB', type: 'address' },
      { indexed: false, name: 'tokenA', type: 'address' },
      { indexed: false, name: 'tokenB', type: 'address' },
      { indexed: false, name: 'amountA', type: 'uint256' },
      { indexed: false, name: 'amountB', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'EscrowCompleted',
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: true, name: 'partyA', type: 'address' },
      { indexed: true, name: 'partyB', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'EscrowCancelled',
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: false, name: 'cancelledBy', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'FundsWithdrawn',
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: true, name: 'by', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
] as const satisfies Abi;

/** Legacy `createEscrow` (6 args) for decoding proposals created before explicit partyA. */
export const escrowLegacyCreateEscrowAbi = [
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
  // Strip any pre-existing marker first so resubmitted descriptions do not
  // accumulate stacked marker blocks (which then leak JSON into the rendered
  // markdown and crash the MDX renderer when it tries to parse `{...}` as JSX).
  const cleanedDescription = stripHyphaInvestmentFormMarker(description);
  return (
    cleanedDescription +
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

    // Validate the payload structure
    if (parsed?.version !== 1) return null;

    // Validate required fields
    if (!parsed.investorAddress || typeof parsed.investorAddress !== 'string') {
      return null;
    }

    // Validate investorAddress format (Ethereum address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(parsed.investorAddress)) {
      return null;
    }

    // Validate investorSendLegs
    if (
      !Array.isArray(parsed.investorSendLegs) ||
      parsed.investorSendLegs.length === 0
    ) {
      return null;
    }

    for (const leg of parsed.investorSendLegs) {
      if (!leg || typeof leg !== 'object') return null;
      if (
        !leg.token ||
        typeof leg.token !== 'string' ||
        !/^0x[a-fA-F0-9]{40}$/.test(leg.token)
      ) {
        return null;
      }
      if (!leg.amount || typeof leg.amount !== 'string') return null;
      // Validate amount is numeric and positive
      const numAmount = Number(leg.amount);
      if (isNaN(numAmount) || numAmount <= 0) return null;
    }

    // Validate spaceReceiveLegs if present
    if (parsed.spaceReceiveLegs !== undefined) {
      if (!Array.isArray(parsed.spaceReceiveLegs)) return null;

      for (const leg of parsed.spaceReceiveLegs) {
        if (!leg || typeof leg !== 'object') return null;
        if (
          !leg.token ||
          typeof leg.token !== 'string' ||
          !/^0x[a-fA-F0-9]{40}$/.test(leg.token)
        ) {
          return null;
        }
        if (!leg.amount || typeof leg.amount !== 'string') return null;
        // Validate amount is numeric and positive
        const numAmount = Number(leg.amount);
        if (isNaN(numAmount) || numAmount <= 0) return null;
        // Validate source if present
        if (
          leg.source !== undefined &&
          leg.source !== 'mint' &&
          leg.source !== 'treasury'
        ) {
          return null;
        }
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Removes embedded investment JSON from proposal description for display.
 *
 * Handles three variants:
 *   1. Canonical marker block (`__hypha_investment__\n{json}\n__end_hypha_investment__`).
 *   2. Markdown-escaped variant the editor produces when re-saving a
 *      resubmitted description (`\_\_hypha\_investment\_\_...\_\_end\_hypha\_investment\_\_`).
 *   3. Orphan end-marker payloads where the start delimiter was mangled away
 *      by markdown stripping (legacy data).
 *
 * Stacked marker blocks (created when older resubmits double-appended the
 * marker) are all removed by iterating until no more matches remain. This
 * matters because leftover JSON inside an MDX-rendered description trips
 * the parser when it tries to read `{...}` as a JS expression and crashes
 * the proposal detail page.
 *
 * Implementation note: this used to be a single `String.prototype.replace`
 * with a regex that combined `\n*` and `[\s\S]*?` — CodeQL flagged it as a
 * polynomial-time regular expression on user-controlled input. The current
 * `indexOf` loop is linear in the input size, has no backtracking, and is
 * easier to reason about per-variant.
 */
export function stripHyphaInvestmentFormMarker(
  description: string | undefined | null,
): string {
  if (!description) return '';

  const variants: Array<{ start: string; end: string }> = [
    { start: '__hypha_investment__', end: '__end_hypha_investment__' },
    {
      start: '\\_\\_hypha\\_investment\\_\\_',
      end: '\\_\\_end\\_hypha\\_investment\\_\\_',
    },
  ];

  let result = description;
  // Hard cap on iterations to defend against pathological inputs; in normal
  // use we expect at most 1–2 stacked blocks.
  const maxIterations = 32;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;
    for (const { start, end } of variants) {
      const sIdx = result.indexOf(start);
      if (sIdx === -1) continue;
      const eIdx = result.indexOf(end, sIdx + start.length);
      if (eIdx === -1) continue;

      // Eat any leading newlines (up to a bounded count) that were inserted
      // by `HYPHA_INVESTMENT_FORM_START` so we don't leave a stack of blank
      // lines behind after the block is removed.
      let trimStart = sIdx;
      let leading = 0;
      while (
        trimStart > 0 &&
        result.charCodeAt(trimStart - 1) === 10 &&
        leading < 8
      ) {
        trimStart -= 1;
        leading += 1;
      }

      let trimEnd = eIdx + end.length;
      if (result.charCodeAt(trimEnd) === 10) trimEnd += 1;

      result = result.slice(0, trimStart) + result.slice(trimEnd);
      changed = true;
    }
    if (!changed) break;
  }

  // Orphan-end-marker fallback for legacy mangled payloads. Run a few
  // times so multiple residues get fully stripped.
  for (let i = 0; i < 3; i += 1) {
    const before = result;
    result = stripOrphanEndInvestmentMarker(result);
    if (result === before) break;
  }

  return result.trimEnd();
}

function stripOrphanEndInvestmentMarker(description: string): string {
  const endMarkers = [
    '__end_hypha_investment__',
    '\\_\\_end\\_hypha\\_investment\\_\\_',
  ];

  for (const marker of endMarkers) {
    const endIdx = description.lastIndexOf(marker);
    if (endIdx === -1) continue;

    const before = description.slice(0, endIdx);
    const jsonAt = before.search(/\{\s*"version"\s*:\s*1/);
    const tagged = before.lastIndexOf('__hypha_investment__');
    const escTagged = before.lastIndexOf('\\_\\_hypha\\_investment\\_\\_');

    let blockStart = -1;
    if (jsonAt !== -1) blockStart = jsonAt;
    else if (tagged !== -1) blockStart = tagged;
    else if (escTagged !== -1) blockStart = escTagged;
    else {
      // Loose `hypha_investment` (with or without an escaped underscore)
      // immediately followed by a JSON-looking object.
      const looseHypha = before.search(/\bhypha\\?_investment\b/);
      if (looseHypha !== -1) {
        const afterStart = before.indexOf('{', looseHypha);
        if (afterStart !== -1 && /^\s*\{\s*"/.test(before.slice(afterStart))) {
          blockStart = looseHypha;
        }
      }
    }

    if (blockStart !== -1) {
      let userEnd = blockStart;
      while (userEnd > 0 && /\s/.test(before[userEnd - 1]!)) {
        userEnd -= 1;
      }
      return (
        description.slice(0, userEnd) +
        description.slice(endIdx + marker.length)
      );
    }
  }

  return description;
}
