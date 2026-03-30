import type { Abi } from 'viem';

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

/** Resolves escrow contract from env; extend with a per-chain map when multiple networks are supported. */
export function getEscrowImplementationAddress(): `0x${string}` | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS?.trim();
  if (v && ADDR_RE.test(v)) return v as `0x${string}`;
  return undefined;
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

export function stripHyphaInvestmentFormMarker(
  description: string | undefined | null,
): string {
  if (!description) return '';
  const start = description.indexOf(HYPHA_INVESTMENT_FORM_START);
  if (start === -1) return description;
  return description.slice(0, start).trimEnd();
}
