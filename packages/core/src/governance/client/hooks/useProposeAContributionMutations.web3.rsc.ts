'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import { publicClient } from '@core/common/web3/public-client';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';
import { getTokenDecimals } from '@core/common/web3/get-token-decimals';

interface CreateProposeAContributionInput {
  spaceId: number;
  payouts: {
    amount: string;
    token: string;
  }[];
  recipient: string;
}

const chainId = 8453;

export const useProposeAContributionMutationsWeb3Rpc = () => {
  const { client } = useSmartWallets();

  const {
    trigger: createProposeAContributionMutation,
    reset: resetCreateProposeAContributionMutation,
    isMutating: isCreatingProposeAContribution,
    data: createProposeAContributionHash,
    error: errorCreateProposeAContribution,
  } = useSWRMutation(
    client ? ['smart-wallet', 'createProposeAContribution'] : null,
    async (_, { arg }: { arg: CreateProposeAContributionInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const transactions = await Promise.all(
        arg.payouts.map(async (payout) => {
          const decimals = await getTokenDecimals(payout.token);
          const amount = parseUnits(payout.amount, decimals);

          return {
            target: payout.token as `0x${string}`,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [arg.recipient as `0x${string}`, amount],
            }),
          } as const;
        }),
      );

      const proposalParams = {
        spaceId: BigInt(arg.spaceId),
        duration: BigInt(86400),
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
    data: createdProposeAContribution,
    isLoading: isLoadingProposeAContributionFromTransaction,
    error: errorWaitProposeAContributionFromTransaction,
  } = useSWR(
    createProposeAContributionHash
      ? [createProposeAContributionHash, 'waitForProposeAContribution']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createProposeAContribution: createProposeAContributionMutation,
    resetCreateProposeAContributionMutation,
    isCreatingProposeAContribution,
    isLoadingProposeAContributionFromTransaction,
    errorCreateProposeAContribution,
    errorWaitProposeAContributionFromTransaction,
    createProposeAContributionHash,
    createdProposeAContribution,
  };
};
