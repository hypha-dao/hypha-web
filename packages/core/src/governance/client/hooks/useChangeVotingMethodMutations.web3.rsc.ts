'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData, zeroAddress } from 'viem';
import { z } from 'zod';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';
import { schemaCreateProposalWeb3 } from '@hypha-platform/core/client';
import { publicClient } from '@hypha-platform/core/client';

import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
  decayingSpaceTokenAbi,
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@hypha-platform/core/generated';

import { transactionSchema } from '@hypha-platform/core/client';
import { VotingMethodType } from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

const chainId = 8453;
type TxData = z.infer<typeof transactionSchema>;

interface ChangeVotingMethodArgs {
  spaceId: number;
  members: { member: string; number: number }[];
  token: string | undefined;
  quorumAndUnity: { quorum: bigint; unity: bigint };
  votingMethod: VotingMethodType;
}

const VOTING_METHOD_MAP: Record<VotingMethodType, bigint> = {
  '1t1v': 1n,
  '1m1v': 2n,
  '1v1v': 3n,
};

export const useChangeVotingMethodMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createChangeVotingMethod,
    reset: resetChangeVotingMethod,
    isMutating: isChangeVotingMethodMutating,
    data: createProposalHash,
    error: errorChangeVotingMethod,
  } = useSWRMutation(
    `changeVotingMethod-${proposalSlug}`,
    async (_, { arg }: { arg: ChangeVotingMethodArgs }) => {
      if (!client) throw new Error('Smart wallet client not available');

      const transactions: TxData[] = [];

      const votingMethodCode = VOTING_METHOD_MAP[arg.votingMethod];

      transactions.push({
        target: daoSpaceFactoryImplementationAddress[chainId],
        value: 0,
        data: encodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          functionName: 'changeVotingMethod',
          args: [
            BigInt(arg.spaceId),
            votingMethodCode,
            arg.quorumAndUnity.unity,
            arg.quorumAndUnity.quorum,
          ],
        }),
      });

      if (arg.votingMethod === '1v1v') {
        const [tokenAddress] = await publicClient.readContract({
          abi: decayingTokenFactoryAbi,
          address: decayingTokenFactoryAddress[chainId],
          functionName: 'getSpaceToken',
          args: [BigInt(arg.spaceId)],
        });

        if (!tokenAddress || tokenAddress === zeroAddress) {
          throw new Error('Invalid token address returned from getSpaceToken');
        }

        for (const { member, number } of arg.members) {
          transactions.push({
            target: tokenAddress,
            value: 0,
            data: encodeFunctionData({
              abi: decayingSpaceTokenAbi,
              functionName: 'mint',
              args: [member as `0x${string}`, BigInt(number) * 10n ** 18n],
            }),
          });
        }
      }

      const input = {
        spaceId: BigInt(arg.spaceId),
        duration: getDuration(4),
        transactions,
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const proposalArgs = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(proposalArgs));
      return txHash;
    },
  );

  const {
    data: changeVotingMethodData,
    isLoading: isLoadingProposalFromTx,
    error: errorWaitProposalFromTx,
  } = useSWR(
    createProposalHash ? [createProposalHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    createChangeVotingMethod,
    resetChangeVotingMethod,
    isChangeVotingMethodMutating,
    createProposalHash,
    errorChangeVotingMethod,
    changeVotingMethodData,
    isLoadingProposalFromTx,
    errorWaitProposalFromTx,
  };
};
