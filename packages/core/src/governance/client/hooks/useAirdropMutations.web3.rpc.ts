'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  decayingSpaceTokenAbi,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';

export type AirdropMethod = 'transfer' | 'mint';

export interface AirdropAllocation {
  method: AirdropMethod;
  recipient: string;
  token: string;
  amount: string;
}

interface CreateAirdropInput {
  spaceId: number;
  airdrop: AirdropAllocation[];
}

const chainId = getGovernanceChainId();

export const useAirdropMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createAirdrop,
    reset: resetCreateAirdropMutation,
    isMutating: isCreatingAirdrop,
    data: createAirdropHash,
    error: errorCreateAirdrop,
  } = useSWRMutation(
    `createAirdrop-${proposalSlug}`,
    async (_, { arg }: { arg: CreateAirdropInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      // Each allocation becomes one mint or transfer action executed by the
      // space Executor when the proposal passes. The Executor runs them all in a
      // single, atomic batch (any failure reverts everything).
      const transactions = await Promise.all(
        arg.airdrop.map(async (allocation) => {
          const decimals = await getTokenDecimals(allocation.token);
          const amount = parseUnits(allocation.amount, decimals);
          const target = allocation.token as `0x${string}`;
          const recipient = allocation.recipient as `0x${string}`;

          if (allocation.method === 'mint') {
            return {
              target,
              value: BigInt(0),
              data: encodeFunctionData({
                abi: decayingSpaceTokenAbi,
                functionName: 'mint',
                args: [recipient, amount],
              }),
            } as const;
          }

          return {
            target,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [recipient, amount],
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
    data: createdAirdrop,
    isLoading: isLoadingAirdropFromTransaction,
    error: errorWaitAirdropFromTransaction,
  } = useSWR(
    createAirdropHash ? [createAirdropHash, 'waitForAirdrop'] : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createAirdrop,
    resetCreateAirdropMutation,
    isCreatingAirdrop,
    createAirdropHash,
    errorCreateAirdrop,
    isLoadingAirdropFromTransaction,
    errorWaitAirdropFromTransaction,
    createdAirdrop,
  };
};
