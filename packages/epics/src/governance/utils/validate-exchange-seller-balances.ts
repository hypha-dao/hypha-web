import { publicClient, getTokenDecimals } from '@hypha-platform/core/client';
import { erc20Abi, parseUnits } from 'viem';

const isEvmAddress = (value: string): value is `0x${string}` =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

export const EXCHANGE_SELLER_BALANCE_EXCEEDED =
  'EXCHANGE_SELLER_BALANCE_EXCEEDED';

type SellerLeg = { amount: string; token: string };

export type ValidateExchangeSellerBalancesInput = {
  sellerRecipientType?: 'member' | 'space';
  sellerAddress: string;
  sellerLeg: SellerLeg[];
  /** On-chain executor for the active space (treasury token holder). */
  spaceExecutorAddress?: string | null;
};

/**
 * Ensures each seller leg amount does not exceed available ERC-20 balance for
 * the seller wallet (member) or space executor treasury (space).
 */
export function resolveSellerBalanceOwner(
  input: ValidateExchangeSellerBalancesInput,
): `0x${string}` | null | 'treasury_unavailable' {
  const { sellerRecipientType, sellerAddress, spaceExecutorAddress } = input;
  const isSpaceSeller = sellerRecipientType === 'space';

  if (isSpaceSeller) {
    if (!spaceExecutorAddress || !isEvmAddress(spaceExecutorAddress)) {
      return 'treasury_unavailable';
    }
    return spaceExecutorAddress;
  }
  if (!sellerAddress || !isEvmAddress(sellerAddress)) {
    return null;
  }
  return sellerAddress;
}

/** Returns whether the leg amount exceeds balance, or skip/error states. */
export async function checkSingleSellerLegBalance(
  owner: `0x${string}`,
  leg: SellerLeg,
): Promise<'ok' | 'exceeds' | 'skip' | 'rpc_error'> {
  if (!leg?.token || !isEvmAddress(leg.token)) return 'skip';

  const trimmed = leg.amount?.trim() ?? '';
  if (!trimmed) return 'skip';

  let decimals: number;
  try {
    decimals = await getTokenDecimals(leg.token);
  } catch {
    return 'rpc_error';
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(trimmed, decimals);
  } catch {
    return 'rpc_error';
  }

  let balanceWei: bigint;
  try {
    balanceWei = await publicClient.readContract({
      address: leg.token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    });
  } catch {
    return 'rpc_error';
  }

  return amountWei > balanceWei ? 'exceeds' : 'ok';
}

export async function validateExchangeSellerLegBalances(
  input: ValidateExchangeSellerBalancesInput,
): Promise<void> {
  const { sellerLeg } = input;

  const owner = resolveSellerBalanceOwner(input);
  if (owner === 'treasury_unavailable') {
    throw new Error('EXCHANGE_SELLER_TREASURY_UNAVAILABLE');
  }
  if (owner === null) {
    return;
  }

  for (let i = 0; i < sellerLeg.length; i++) {
    const leg = sellerLeg[i];
    const result = await checkSingleSellerLegBalance(owner, leg);
    if (result === 'rpc_error') {
      throw new Error('EXCHANGE_SELLER_BALANCE_CHECK_FAILED');
    }
    if (result === 'exceeds') {
      const err = new Error(EXCHANGE_SELLER_BALANCE_EXCEEDED);
      (err as Error & { legIndex: number }).legIndex = i;
      throw err;
    }
  }
}
