'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';
import { publicClient } from '../../../common';
import { schemaCreateProposalWeb3, transactionSchema } from '../../validation';
import { z } from 'zod';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '../../../generated';
import { encodeFunctionData } from 'viem';
import { getDuration } from '@hypha-platform/ui-utils';
import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';
import useSWR from 'swr';
import { getSpaceMinProposalDuration } from '../../../client';

interface MembershipExitInput {
  spaceId: number;
  memberAddress: `0x${string}`;
}

export const useMembershipExitWeb3Rpc = ({
  proposalSlug,
  chain = 8453,
}: {
  proposalSlug?: string | null;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: membershipExit,
    reset: resetMembershipExitMutation,
    isMutating: isCreating,
    data: membershipHash,
    error: membershipError,
  } = useSWRMutation(
    `membershipExit-${proposalSlug}`,
    async (_, { arg }: { arg: MembershipExitInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: z.infer<typeof transactionSchema>[] = [
        {
          target: daoSpaceFactoryImplementationAddress[chain] as `0x${string}`,
          value: 0,
          data: encodeFunctionData({
            abi: daoSpaceFactoryImplementationAbi,
            functionName: 'removeMember',
            args: [BigInt(arg.spaceId), arg.memberAddress],
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
    isLoading: isLoadingMembersFromTx,
    error: errorWaitMembershipFromTx,
  } = useSWR(
    membershipHash ? [membershipHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    membershipExit,
    resetMembershipExitMutation,
    isCreating,
    membershipHash,
    membershipData,
    isLoadingMembersFromTx,
    errorWaitMembershipFromTx,
    membershipError,
  };
};
