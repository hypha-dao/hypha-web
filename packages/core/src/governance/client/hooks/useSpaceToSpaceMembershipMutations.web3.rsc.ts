'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  publicClient,
  getProposalFromLogs,
  createProposal,
  mapToCreateProposalWeb3Input,
  getSpaceMinProposalDuration,
  transactionSchema,
  schemaCreateProposalWeb3,
} from '@hypha-platform/core/client';
import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '../../../generated';
import { getDuration } from '@hypha-platform/ui-utils';
import z from 'zod';

const chainId = 8453;

interface SpaceToSpaceMembershipInput {
  space: number;
  member: string;
  spaceId: number;
}

export const useSpaceToSpaceMembershipWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: spaceToSpaceMembership,
    reset: resetSpaceToSpaceMembershipMutation,
    isMutating: isCreating,
    data: membershipHash,
    error: membershipError,
  } = useSWRMutation(
    `spaceToSpaceMembership-${proposalSlug}`,
    async (_, { arg }: { arg: SpaceToSpaceMembershipInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: z.infer<typeof transactionSchema>[] = [
        {
          target: daoSpaceFactoryImplementationAddress[
            chainId
          ] as `0x${string}`,
          value: 0,
          data: encodeFunctionData({
            abi: daoSpaceFactoryImplementationAbi,
            functionName: 'joinSpace',
            args: [BigInt(arg.space)],
          }),
        },
        {
          target: votingPowerDelegationImplementationAddress[
            chainId
          ] as `0x${string}`,
          value: 0,
          data: encodeFunctionData({
            abi: votingPowerDelegationImplementationAbi,
            functionName: 'delegate',
            args: [arg.member as `0x${string}`, BigInt(arg.space)],
          }),
        },
      ];

      const input = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions,
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const proposalArgs = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(proposalArgs));
      return txHash;
    },
  );

  const {
    data: membershipData,
    isLoading: isLoadingMembershipFromTx,
    error: errorWaitMembershipFromTx,
  } = useSWR(
    membershipHash ? [membershipHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    spaceToSpaceMembership,
    resetSpaceToSpaceMembershipMutation,
    isCreating,
    membershipHash,
    membershipData,
    isLoadingMembershipFromTx,
    errorWaitMembershipFromTx,
    membershipError,
  };
};
