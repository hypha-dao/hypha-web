'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  decayingSpaceTokenAbi,
} from '@hypha-platform/core/generated';
import {
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

interface TokenBurnRowInput {
  type: 'member' | 'space';
  address: `0x${string}`;
  amount?: string;
  allBalance?: boolean;
}

interface CreateTokenBurningInput {
  spaceId: number;
  tokenBurning: {
    token: `0x${string}`;
    burns: TokenBurnRowInput[];
  };
}

const chainId = 8453;

const toTokenAmount = (amount: string) => {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  return BigInt(Math.round(parsed * 1_000_000)) * 10n ** 12n;
};

export const useTokenBurningMutationsWeb3Rsc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createTokenBurning,
    reset: resetCreateTokenBurningMutation,
    isMutating: isCreatingTokenBurning,
    data: createTokenBurningHash,
    error: errorCreateTokenBurning,
  } = useSWRMutation(
    `tokenBurning-${proposalSlug}`,
    async (_, { arg }: { arg: CreateTokenBurningInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const burnTargets = await Promise.all(
        arg.tokenBurning.burns.map(async (row) => {
          if (row.allBalance) {
            const balance = await publicClient.readContract({
              address: arg.tokenBurning.token,
              abi: decayingSpaceTokenAbi,
              functionName: 'balanceOf',
              args: [row.address],
            });
            return { ...row, burnAmount: balance };
          }

          if (!row.amount || row.amount.trim() === '') {
            throw new Error('Please enter amount');
          }

          return { ...row, burnAmount: toTokenAmount(row.amount) };
        }),
      );

      const transactions = [
        ...burnTargets.map((target) => ({
          target: arg.tokenBurning.token as `0x${string}`,
          value: 0n,
          data: encodeFunctionData({
            abi: decayingSpaceTokenAbi,
            functionName: 'burnFrom',
            args: [target.address, target.burnAmount],
          }),
        })),
      ];

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
    data: createdTokenBurning,
    isLoading: isLoadingTokenBurningFromTransaction,
    error: errorWaitTokenBurningFromTransaction,
  } = useSWR(
    createTokenBurningHash ? [createTokenBurningHash, 'waitForTokenBurning'] : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createTokenBurning,
    resetCreateTokenBurningMutation,
    isCreatingTokenBurning,
    createTokenBurningHash,
    errorCreateTokenBurning,
    isLoadingTokenBurningFromTransaction,
    errorWaitTokenBurningFromTransaction,
    createdTokenBurning,
  };
};
