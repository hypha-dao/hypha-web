'use client';

import useSWRMutation from 'swr/mutation';
import { encodeFunctionData, erc20Abi, maxUint256, parseUnits } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  schemaCreateProposalWeb3,
  publicClient,
  getSpaceMinProposalDuration,
  TOKENS,
  getTokenDecimals,
} from '@hypha-platform/core/client';
import { mapToCreateProposalWeb3Input, createProposal } from '../web3';
import { decayingSpaceTokenAbi } from '@hypha-platform/core/generated';
import { getDuration } from '@hypha-platform/ui-utils';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const TOKENS_SAFE = Array.isArray(TOKENS) ? TOKENS : [];
const USDC_TOKEN = TOKENS_SAFE.find((token) => token.symbol === 'USDC');
const EURC_TOKEN = TOKENS_SAFE.find((token) => token.symbol === 'EURC');

type SpaceTokenPurchaseInput = {
  spaceId: number;
  tokenAddress: `0x${string}`;
  activatePurchase: boolean;
  purchasePrice?: number;
  purchaseCurrency?: string;
  tokensAvailableForPurchase?: number;
};

export const useSpaceTokenPurchaseMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createSpaceTokenPurchaseProposal,
    reset: resetCreateSpaceTokenPurchaseProposal,
    isMutating: isCreatingSpaceTokenPurchaseProposal,
    data: createSpaceTokenPurchaseHash,
    error: createSpaceTokenPurchaseError,
  } = useSWRMutation(
    `spaceTokenPurchase-${proposalSlug}`,
    async (_: string, { arg }: { arg: SpaceTokenPurchaseInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: Array<{
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }> = [];

      const paymentTokenAddress = (() => {
        if (!arg.activatePurchase) return ZERO_ADDRESS;
        if (!arg.purchaseCurrency) {
          throw new Error(
            'Purchase currency is required when activating purchase',
          );
        }
        if (arg.purchaseCurrency === 'EUR') {
          if (!EURC_TOKEN?.address) {
            throw new Error('EURC token is not configured');
          }
          return EURC_TOKEN.address as `0x${string}`;
        }
        if (arg.purchaseCurrency === 'USD') {
          if (!USDC_TOKEN?.address) {
            throw new Error('USDC token is not configured');
          }
          return USDC_TOKEN.address as `0x${string}`;
        }
        throw new Error(
          `Unsupported purchase currency: ${arg.purchaseCurrency}`,
        );
      })();
      const paymentTokenDecimals =
        paymentTokenAddress !== ZERO_ADDRESS
          ? await getTokenDecimals(paymentTokenAddress)
          : 6;
      const paymentTokenPricePerToken =
        arg.activatePurchase && arg.purchasePrice !== undefined
          ? parseUnits(String(arg.purchasePrice), paymentTokenDecimals)
          : 0n;
      const tokensForSale =
        arg.activatePurchase && arg.tokensAvailableForPurchase !== undefined
          ? parseUnits(String(arg.tokensAvailableForPurchase), 18)
          : 0n;

      // Allow the token contract to move sale inventory from the space executor
      // when the proposal is executed.
      if (arg.activatePurchase && tokensForSale > 0n) {
        transactions.push({
          target: arg.tokenAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [arg.tokenAddress, maxUint256],
          }),
        });
      }

      transactions.push({
        target: arg.tokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: decayingSpaceTokenAbi,
          functionName: 'configureTokenSale',
          args: [paymentTokenAddress, paymentTokenPricePerToken, tokensForSale],
        }),
      });

      const parsedInput = schemaCreateProposalWeb3.parse({
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions,
      });

      const proposalArgs = mapToCreateProposalWeb3Input(parsedInput);
      const txHash = await client.writeContract(createProposal(proposalArgs));

      return txHash;
    },
  );

  return {
    createSpaceTokenPurchaseProposal,
    resetCreateSpaceTokenPurchaseProposal,
    isCreatingSpaceTokenPurchaseProposal,
    createSpaceTokenPurchaseHash,
    createSpaceTokenPurchaseError,
  };
};
