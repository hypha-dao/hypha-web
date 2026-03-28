'use client';

import useSWR from 'swr';
import { formatUnits } from 'viem';
import {
  publicClient,
  getTokenDecimals,
  TOKENS,
} from '@hypha-platform/core/client';

/** Minimal decaying space token reads — no standalone `saleEnabled` bool; sale is off iff `paymentToken()` is zero (see `configureTokenSale`). */
const spaceTokenPurchaseAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'paymentToken',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getTokenSaleDetails',
    outputs: [
      { name: 'salePaymentToken', internalType: 'address', type: 'address' },
      { name: 'salePricePerToken', internalType: 'uint256', type: 'uint256' },
      { name: 'tokensLeftToSell', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

const ZERO = '0x0000000000000000000000000000000000000000';

const paymentTokenToReferenceCurrency = (
  paymentToken: `0x${string}` | undefined,
): 'USD' | 'EUR' | undefined => {
  const lower = paymentToken?.toLowerCase();
  const usdc = TOKENS.find((t) => t.symbol === 'USDC')?.address?.toLowerCase();
  const eurc = TOKENS.find((t) => t.symbol === 'EURC')?.address?.toLowerCase();
  if (lower === usdc) return 'USD';
  if (lower === eurc) return 'EUR';
  return undefined;
};

export type SpaceTokenSaleDetailsFromChain = {
  /** From `paymentToken()`: non-zero means sale is configured (matches proposal `isActive`). */
  activatePurchase: boolean;
  purchasePrice?: number;
  purchaseCurrency?: 'USD' | 'EUR';
  tokensAvailableForPurchase?: number;
};

export const useSpaceTokenSaleDetailsFromChain = ({
  tokenAddress,
  enabled,
}: {
  tokenAddress?: `0x${string}`;
  enabled: boolean;
}) => {
  return useSWR(
    enabled && tokenAddress
      ? ['spaceTokenSaleDetailsHydrate', tokenAddress]
      : null,
    async ([, addr]) => {
      const [storedPaymentToken, saleDetails] = await Promise.all([
        publicClient.readContract({
          address: addr as `0x${string}`,
          abi: spaceTokenPurchaseAbi,
          functionName: 'paymentToken',
        }),
        publicClient.readContract({
          address: addr as `0x${string}`,
          abi: spaceTokenPurchaseAbi,
          functionName: 'getTokenSaleDetails',
        }),
      ]);

      const [salePaymentToken, salePricePerToken, tokensLeftToSell] =
        saleDetails;

      const saleActive =
        Boolean(storedPaymentToken) &&
        storedPaymentToken.toLowerCase() !== ZERO.toLowerCase();

      if (!saleActive) {
        return {
          activatePurchase: false,
        } satisfies SpaceTokenSaleDetailsFromChain;
      }

      const currency = paymentTokenToReferenceCurrency(salePaymentToken);
      if (!currency) {
        return {
          activatePurchase: true,
        } satisfies SpaceTokenSaleDetailsFromChain;
      }

      const decimals = await getTokenDecimals(salePaymentToken);
      const purchasePrice = Number(formatUnits(salePricePerToken, decimals));
      const tokensAvailableForPurchase = Number(
        formatUnits(tokensLeftToSell, 18),
      );

      return {
        activatePurchase: true,
        purchasePrice,
        purchaseCurrency: currency,
        tokensAvailableForPurchase,
      } satisfies SpaceTokenSaleDetailsFromChain;
    },
    { revalidateOnFocus: false },
  );
};
