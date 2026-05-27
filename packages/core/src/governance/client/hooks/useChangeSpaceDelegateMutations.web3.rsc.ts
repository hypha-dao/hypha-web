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
} from '../../../generated';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';
import z from 'zod';

const chainId = getGovernanceChainId();

interface ChangeSpaceDelegateInput {
  space: number;
  member: string;
  spaceId: number;
}

export const useChangeSpaceDelegateWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: changeSpaceDelegate,
    reset: resetChangeSpaceDelegateMutation,
    isMutating: isCreating,
    data: changeDelegateHash,
    error: changeDelegateError,
  } = useSWRMutation(
    `changeSpaceDelegate-${proposalSlug}`,
    async (_, { arg }: { arg: ChangeSpaceDelegateInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: z.infer<typeof transactionSchema>[] = [
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
    data: changeDelegateData,
    isLoading: isLoadingChangeDelegateFromTx,
    error: errorWaitChangeDelegateFromTx,
  } = useSWR(
    changeDelegateHash ? [changeDelegateHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    changeSpaceDelegate,
    resetChangeSpaceDelegateMutation,
    isCreating,
    changeDelegateHash,
    changeDelegateData,
    isLoadingChangeDelegateFromTx,
    errorWaitChangeDelegateFromTx,
    changeDelegateError,
  };
};
