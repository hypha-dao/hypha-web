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
export async function validateExchangeSellerLegBalances(
  input: ValidateExchangeSellerBalancesInput,
): Promise<void> {
  const {
    sellerRecipientType,
    sellerAddress,
    sellerLeg,
    spaceExecutorAddress,
  } = input;

  const isSpaceSeller = sellerRecipientType === 'space';

  let owner: `0x${string}` | undefined;
  if (isSpaceSeller) {
    if (!spaceExecutorAddress || !isEvmAddress(spaceExecutorAddress)) {
      throw new Error('EXCHANGE_SELLER_TREASURY_UNAVAILABLE');
    }
    owner = spaceExecutorAddress;
  } else {
    if (!sellerAddress || !isEvmAddress(sellerAddress)) {
      return;
    }
    owner = sellerAddress;
  }

  for (let i = 0; i < sellerLeg.length; i++) {
    const leg = sellerLeg[i];
    if (!leg?.token || !isEvmAddress(leg.token)) continue;

    const trimmed = leg.amount?.trim() ?? '';
    if (!trimmed) continue;

    let decimals: number;
    try {
      decimals = await getTokenDecimals(leg.token);
    } catch {
      throw new Error('EXCHANGE_SELLER_BALANCE_CHECK_FAILED');
    }

    let amountWei: bigint;
    try {
      amountWei = parseUnits(trimmed, decimals);
    } catch {
      throw new Error('EXCHANGE_SELLER_BALANCE_CHECK_FAILED');
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
      throw new Error('EXCHANGE_SELLER_BALANCE_CHECK_FAILED');
    }

    if (amountWei > balanceWei) {
      const err = new Error(EXCHANGE_SELLER_BALANCE_EXCEEDED);
      (err as Error & { legIndex: number }).legIndex = i;
      throw err;
    }
  }
}
