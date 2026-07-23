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
import { assertAirdropOwnershipRecipientsAreMembers } from './assert-airdrop-ownership-recipients';

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

export {
  AIRDROP_OWNERSHIP_RECIPIENT_NOT_MEMBER,
  AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED,
  assertAirdropOwnershipRecipientsAreMembers,
} from './assert-airdrop-ownership-recipients';

const chainId = getGovernanceChainId();

/**
 * Web3 mutation hook for airdrop proposals. Builds one mint/transfer action per
 * allocation (resolving token decimals once per unique token) and submits them
 * as a single atomic proposal via the DAO proposals contract, then resolves the
 * created proposal from the transaction logs.
 *
 * @param params - Optional proposal slug used to scope the SWR mutation cache key.
 * @returns Create trigger, reset, loading/error flags, the tx hash, and created proposal.
 */
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

      // Ownership tokens revert executor transfers/mints to non-members. Block
      // proposal creation up front so Auto-Execution cannot fail at vote time.
      const tokenAddress = arg.airdrop[0]?.token;
      if (tokenAddress) {
        await assertAirdropOwnershipRecipientsAreMembers({
          spaceId: arg.spaceId,
          tokenAddress,
          recipients: arg.airdrop.map((allocation) => allocation.recipient),
        });
      }

      // readContract can throw (RPC/contract errors); fall back to a safe
      // 7-day default so airdrop proposal creation is never aborted by it.
      let duration = getDuration(7);
      try {
        const minDuration = await publicClient.readContract(
          getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
        );
        if (minDuration && minDuration > 0) {
          duration = minDuration;
        }
      } catch {
        // keep safe fallback duration
      }

      // Decimals only depend on the token, so resolve each unique token once
      // (airdrops share a single token across all recipients).
      const decimalsByToken = new Map<string, number>();
      await Promise.all(
        [...new Set(arg.airdrop.map((a) => a.token.toLowerCase()))].map(
          async (token) => {
            decimalsByToken.set(token, await getTokenDecimals(token));
          },
        ),
      );

      // Each allocation becomes one mint or transfer action executed by the
      // space Executor when the proposal passes. The Executor runs them all in a
      // single, atomic batch (any failure reverts everything).
      const transactions = arg.airdrop.map((allocation) => {
        const decimals =
          decimalsByToken.get(allocation.token.toLowerCase()) ?? 18;
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
      });

      const proposalParams = {
        spaceId: BigInt(arg.spaceId),
        duration,
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
