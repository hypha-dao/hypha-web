'use client';

import useSWRMutation from 'swr/mutation';
import { Config, writeContract } from '@wagmi/core';
import { getProposalFromLogs } from '../web3';
import useSWR from 'swr';
import { publicClient } from '@core/common/web3/public-client';
import { encodeFunctionData, erc20Abi, getContract, parseUnits } from 'viem';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';

interface CreateDeployFundsInput {
  spaceId: number;
  payouts: {
    amount: string;
    token: string;
  }[];
  recipient: string;
}

async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const contract = getContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    client: publicClient,
  });

  return await contract.read.decimals();
}

export const useDeployFundsMutationsWeb3Rpc = (config?: Config) => {
  const {
    trigger: createDeployFundsMutation,
    reset: resetCreateDeployFundsMutation,
    isMutating: isCreatingDeployFunds,
    data: createDeployFundsHash,
    error: errorCreateDeployFunds,
  } = useSWRMutation(
    config ? [config, 'createDeployFunds'] : null,
    async ([config], { arg }: { arg: CreateDeployFundsInput }) => {
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
        transactions: transactions as readonly {
          target: `0x${string}`;
          value: bigint;
          data: `0x${string}`;
        }[],
      };

      return writeContract(config, {
        address: daoProposalsImplementationAddress[8453],
        abi: daoProposalsImplementationAbi,
        functionName: 'createProposal',
        args: [proposalParams],
      });
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
    createDeployFunds: createDeployFundsMutation,
    resetCreateDeployFundsMutation,
    isCreatingDeployFunds,
    isLoadingDeployFundsFromTransaction,
    errorCreateDeployFunds,
    errorWaitDeployFundsFromTransaction,
    createDeployFundsHash,
    createdDeployFunds,
  };
};
