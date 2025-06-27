'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import { publicClient } from '@core/common/web3/public-client';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';
import { getTokenDecimals } from '@core/common/web3/get-token-decimals';

interface CreateDeployFundsInput {
  spaceId: number;
  payouts: {
    amount: string;
    token: string;
  }[];
  recipient: string;
}

const chainId = 8453;

export const useDeployFundsMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createDeployFunds,
    reset: resetCreateDeployFundsMutation,
    isMutating: isCreatingDeployFunds,
    data: createDeployFundsHash,
    error: errorCreateDeployFunds,
  } = useSWRMutation(
    client ? ['smart-wallet', 'createDeployFunds', proposalSlug] : null,
    async (_, { arg }: { arg: CreateDeployFundsInput }) => {
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
    data: createdDeployFunds,
    isLoading: isLoadingDeployFundsFromTransaction,
    error: errorWaitDeployFundsFromTransaction,
  } = useSWR(
    createDeployFundsHash
      ? [createDeployFundsHash, 'waitForDeployFunds']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createDeployFunds,
    resetCreateDeployFundsMutation,
    isCreatingDeployFunds,
    isLoadingDeployFundsFromTransaction,
    errorCreateDeployFunds,
    errorWaitDeployFundsFromTransaction,
    createDeployFundsHash,
    createdDeployFunds,
  };
};
