'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

interface CreatePayForExpensesInput {
  spaceId: number;
  payouts: {
    amount: string;
    token: string;
  }[];
  recipient: string;
}

const chainId = 8453;

export const usePayForExpensesMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createPayForExpenses,
    reset: resetCreatePayForExpensesMutation,
    isMutating: isCreatingPayForExpenses,
    data: createPayForExpensesHash,
    error: errorCreatePayForExpenses,
  } = useSWRMutation(
    `createPayForExpenses-${proposalSlug}`,
    async (_, { arg }: { arg: CreatePayForExpensesInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

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
    data: createdPayForExpenses,
    isLoading: isLoadingPayForExpensesFromTransaction,
    error: errorWaitPayForExpensesFromTransaction,
  } = useSWR(
    createPayForExpensesHash
      ? [createPayForExpensesHash, 'waitForPayForExpenses']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createPayForExpenses,
    resetCreatePayForExpensesMutation,
    isCreatingPayForExpenses,
    createPayForExpensesHash,
    errorCreatePayForExpenses,
    isLoadingPayForExpensesFromTransaction,
    errorWaitPayForExpensesFromTransaction,
    createdPayForExpenses,
  };
};
