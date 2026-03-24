'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import { getTokenDecimals, publicClient } from '@hypha-platform/core/client';

const spaceTokenPurchaseAbi = [
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
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'canAccountPurchase',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'purchaseEligibilityMode',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'executor',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenAmount', internalType: 'uint256', type: 'uint256' }],
    name: 'buyTokens',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

type BuySpaceTokensInput = {
  tokenAddress: `0x${string}`;
  amount: string;
};

const BASE_TOKEN_UNIT = 10n ** 18n;

export const useBuySpaceTokensMutation = ({
  tokenAddress,
  amount,
}: {
  tokenAddress?: `0x${string}`;
  amount?: string;
}) => {
  const { client } = useSmartWallets();

  const buyerAddress = useMemo(
    () =>
      (client as { account?: { address?: `0x${string}` } } | null)?.account
        ?.address,
    [client],
  );

  const { data, isLoading, error, mutate } = useSWR(
    tokenAddress
      ? ['spaceTokenSale', tokenAddress, buyerAddress, amount]
      : null,
    async ([, contractAddress, account, amountValue]) => {
      const [saleDetails, canPurchase, purchaseEligibilityMode, executor] =
        await Promise.all([
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: spaceTokenPurchaseAbi,
            functionName: 'getTokenSaleDetails',
          }),
          account
            ? publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: spaceTokenPurchaseAbi,
                functionName: 'canAccountPurchase',
                args: [account as `0x${string}`],
              })
            : Promise.resolve(false),
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: spaceTokenPurchaseAbi,
            functionName: 'purchaseEligibilityMode',
          }),
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: spaceTokenPurchaseAbi,
            functionName: 'executor',
          }),
        ]);

      const [salePaymentToken, salePricePerToken, tokensLeftToSell] =
        saleDetails;
      const paymentTokenDecimals = await getTokenDecimals(salePaymentToken);

      const tokenAmount =
        amountValue && amountValue.trim().length > 0
          ? parseUnits(amountValue, 18)
          : 0n;
      const paymentAmount =
        tokenAmount > 0n
          ? (tokenAmount * salePricePerToken) / BASE_TOKEN_UNIT
          : 0n;

      const [allowance, balance] = account
        ? await Promise.all([
            publicClient.readContract({
              address: salePaymentToken,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [
                account as `0x${string}`,
                contractAddress as `0x${string}`,
              ],
            }),
            publicClient.readContract({
              address: salePaymentToken,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account as `0x${string}`],
            }),
          ])
        : [0n, 0n];

      return {
        salePaymentToken,
        salePricePerToken,
        tokensLeftToSell,
        purchaseEligibilityMode,
        canPurchase,
        executor,
        paymentTokenDecimals: paymentTokenDecimals ?? 6,
        tokenAmount,
        paymentAmount,
        allowance,
        balance,
      };
    },
    {
      shouldRetryOnError: false,
      revalidateOnFocus: true,
    },
  );

  const {
    trigger: approve,
    isMutating: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useSWRMutation(
    tokenAddress && data && buyerAddress
      ? ['spaceTokenPurchaseApprove', tokenAddress, buyerAddress]
      : null,
    async () => {
      if (!client) throw new Error('Smart wallet client not available');
      if (!tokenAddress || !data)
        throw new Error('Token sale details are missing');
      if (data.paymentAmount <= 0n) {
        throw new Error('Enter a valid token amount');
      }

      const hash = await client.writeContract({
        address: data.salePaymentToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [tokenAddress, data.paymentAmount],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await mutate();

      return hash;
    },
  );

  const {
    trigger: buy,
    isMutating: isBuying,
    error: buyError,
    reset: resetBuy,
  } = useSWRMutation(
    tokenAddress && data && buyerAddress
      ? ['spaceTokenPurchaseBuy', tokenAddress, buyerAddress]
      : null,
    async () => {
      if (!client) throw new Error('Smart wallet client not available');
      if (!tokenAddress || !data)
        throw new Error('Token sale details are missing');

      if (
        data.salePaymentToken === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error('Sale is not active.');
      }
      if (data.salePricePerToken <= 0n) {
        throw new Error('Sale price is missing.');
      }
      if (data.tokenAmount <= 0n) {
        throw new Error('Enter a valid token amount');
      }
      if (data.tokensLeftToSell < data.tokenAmount) {
        throw new Error('Not enough tokens remaining in this sale.');
      }
      if (!data.canPurchase) {
        throw new Error('This wallet is not eligible to buy this token.');
      }
      if (data.balance < data.paymentAmount) {
        throw new Error('Insufficient payment token balance.');
      }
      if (data.allowance < data.paymentAmount) {
        throw new Error('Approval required before buying tokens.');
      }

      const hash = await client.writeContract({
        address: tokenAddress,
        abi: spaceTokenPurchaseAbi,
        functionName: 'buyTokens',
        args: [data.tokenAmount],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await mutate();

      return hash;
    },
  );

  const reset = useCallback(() => {
    resetApprove();
    resetBuy();
  }, [resetApprove, resetBuy]);

  return {
    buyerAddress,
    sale: data,
    isLoadingSale: isLoading,
    saleError: error,
    refreshSale: mutate,
    needsApproval: Boolean(data && data.paymentAmount > data.allowance),
    hasEnoughBalance: Boolean(data && data.balance >= data.paymentAmount),
    approve,
    buy,
    isApproving,
    isBuying,
    approveError,
    buyError,
    reset,
  };
};
