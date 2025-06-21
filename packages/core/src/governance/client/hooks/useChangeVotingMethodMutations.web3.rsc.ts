'use client';

import { Config, writeContract } from '@wagmi/core';
import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData } from 'viem';
import { publicClient } from '@core/common/web3/public-client';
import { schemaCreateProposalWeb3 } from '@core/governance/validation';
import {
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
  createProposal,
} from '../web3';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import {
  decayingSpaceTokenAbi,
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@core/generated';

interface ChangeVotingMethodArgs {
  spaceId: number;
  members: { member: string; number: number }[];
  token: `0x${string}` | undefined;
  quorumAndUnity: { quorum: bigint; unity: bigint };
  votingMethod: '1m1v' | '1v1v' | '1t1v';
}

export const useChangeVotingMethodMutationsWeb3Rpc = (config?: Config) => {
  const {
    trigger: createChangeVotingMethod,
    reset: resetChangeVotingMethod,
    isMutating: isChangeVotingMethodMutating,
    data: createProposalHash,
    error: errorChangeVotingMethod,
  } = useSWRMutation(
    config ? [config, 'changeVotingMethod'] : null,
    async ([cfg], { arg }: { arg: ChangeVotingMethodArgs }) => {
      const chainId = 8453;

      const txData: Array<{
        target: `0x${string}`;
        value: number;
        data: `0x${string}`;
      }> = [];

      txData.push({
        target: daoSpaceFactoryImplementationAddress[chainId],
        value: 0,
        data: encodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          functionName: 'changeVotingMethod',
          args: [
            BigInt(arg.spaceId),
            BigInt(
              arg.votingMethod === '1m1v'
                ? 2
                : arg.votingMethod === '1v1v'
                ? 1
                : 2,
            ),
            BigInt(arg.quorumAndUnity.unity),
            BigInt(arg.quorumAndUnity.quorum),
          ],
        }),
      });

      if (arg.votingMethod === '1v1v') {
        const tokenAddress = await publicClient.readContract({
          abi: decayingTokenFactoryAbi,
          address: decayingTokenFactoryAddress[chainId],
          functionName: 'getSpaceToken',
          args: [BigInt(arg.spaceId)],
        });

        arg.members.forEach(({ member, number }) => {
          txData.push({
            target: tokenAddress as `0x${string}`,
            value: 0,
            data: encodeFunctionData({
              abi: decayingSpaceTokenAbi,
              functionName: 'mint',
              args: [member as `0x${string}`, BigInt(number) * 10n ** 18n],
            }),
          });
        });
      }

      const parsedProposal = schemaCreateProposalWeb3.parse({
        spaceId: arg.spaceId,
        duration: 604800,
        transactions: txData,
      });

      const proposalArgs = mapToCreateProposalWeb3Input(parsedProposal);
      return writeContract(cfg, createProposal(proposalArgs));
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
