'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
  percentageStringToBigInt,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

interface CreateRedeemTokensInput {
  redemption: {
    web3SpaceId: number;
    amount: string;
    token: string;
  };
  conversions: {
    asset: string;
    percentage: string;
  }[];
}

const chainId = 8453;

export const useRedeemTokensMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createRedeemTokens,
    reset: resetCreateRedeemTokensMutation,
    isMutating: isCreatingRedeemTokens,
    data: createRedeemTokensHash,
    error: errorCreateRedeemTokens,
  } = useSWRMutation(
    `createRedeemTokens-${proposalSlug}`,
    async (_, { arg }: { arg: CreateRedeemTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({
          spaceId: BigInt(arg.redemption.web3SpaceId),
        }),
      );

      const backingTokens: `0x${string}`[] = [];
      const proportions: bigint[] = [];

      for (const conversion of arg.conversions) {
        if (!conversion.asset || !conversion.percentage) {
          continue;
        }
        backingTokens.push(conversion.asset as `0x${string}`);
        const percentage = percentageStringToBigInt(conversion.percentage);
        proportions.push(percentage);
      }

      const decimals = await getTokenDecimals(arg.redemption.token);
      const amount = parseUnits(arg.redemption.amount, decimals);

      const data = encodeFunctionData({
        abi: tokenBackingVaultImplementationAbi,
        functionName: 'redeem',
        args: [
          BigInt(arg.redemption.web3SpaceId),
          arg.redemption.token as `0x${string}`,
          amount,
          backingTokens,
          proportions,
        ],
      });

      const transactions = [
        {
          target: tokenBackingVaultImplementationAddress[chainId],
          value: BigInt(0),
          data,
        } as const,
      ];

      const proposalParams = {
        spaceId: BigInt(arg.redemption.web3SpaceId),
        duration: duration && duration > 0 ? duration : getDuration(7),
        transactions,
      };

      const txHash = await client.writeContract({
        address: daoProposalsImplementationAddress[chainId],
        abi: daoProposalsImplementationAbi,
        functionName: 'createProposal',
        args: [proposalParams],
      });

      return txHash;
    },
  );

  const {
    data: createdRedeemTokens,
    isLoading: isLoadingRedeemTokensFromTransaction,
    error: errorWaitRedeemTokensFromTransaction,
  } = useSWR(
    createRedeemTokensHash
      ? [createRedeemTokensHash, 'waitForRedeemTokens']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createRedeemTokens,
    resetCreateRedeemTokensMutation,
    isCreatingRedeemTokens,
    isLoadingRedeemTokensFromTransaction,
    errorCreateRedeemTokens,
    errorWaitRedeemTokensFromTransaction,
    createRedeemTokensHash,
    createdRedeemTokens,
  };
};
