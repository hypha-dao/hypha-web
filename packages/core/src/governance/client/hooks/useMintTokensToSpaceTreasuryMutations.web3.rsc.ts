'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getSpaceMinProposalDuration,
  publicClient,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';
import { decayingSpaceTokenAbi } from '@hypha-platform/core/generated';
import { useParams } from 'next/navigation';

interface CreateMintTokensToSpaceTreasuryInput {
  spaceId: number;
  mint: {
    amount: number;
    token: `0x${string}`;
  };
}

const chainId = 8453;

export const useMintTokensToSpaceTreasuryMutationsWeb3Rsc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug(spaceSlug as string);

  const {
    trigger: mintTokensToSpaceTreasury,
    reset: resetCreateMintTokensToTreasuryMutation,
    isMutating: isCreatingMintTokensToTreasury,
    data: mintTokensToSpaceTreasuryHash,
    error: errorCreateMintTokensToTreasury,
  } = useSWRMutation(
    `mintTokensToSpaceTreasury-${proposalSlug}`,
    async (_, { arg }: { arg: CreateMintTokensToSpaceTreasuryInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions = [
        {
          target: arg.mint.token as `0x${string}`,
          value: 0n,
          data: encodeFunctionData({
            abi: decayingSpaceTokenAbi,
            functionName: 'mint',
            args: [
              space?.address as `0x${string}`,
              BigInt(arg.mint.amount) * 10n ** 18n,
            ],
          }),
        },
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
    data: createdMintTokensToTreasury,
    isLoading: isLoadingMintTokensToTreasuryFromTransaction,
    error: errorWaitMintTokensToTreasuryFromTransaction,
  } = useSWR(
    mintTokensToSpaceTreasuryHash
      ? [mintTokensToSpaceTreasuryHash, 'waitForMintTokensToTreasury']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    mintTokensToSpaceTreasury,
    resetCreateMintTokensToTreasuryMutation,
    isCreatingMintTokensToTreasury,
    mintTokensToSpaceTreasuryHash,
    errorCreateMintTokensToTreasury,
    isLoadingMintTokensToTreasuryFromTransaction,
    errorWaitMintTokensToTreasuryFromTransaction,
    createdMintTokensToTreasury,
  };
};
