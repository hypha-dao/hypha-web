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
  regularTokenFactoryAbi,
  regularTokenFactoryAddress,
  ownershipTokenFactoryAbi,
  ownershipTokenFactoryAddress,
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@core/generated';

interface CreateTokenArgs {
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
  type: 'utility' | 'credits' | 'ownership' | 'voice';
  decayPercentage?: number;
  decayInterval?: number;
}

export const useIssueTokenMutationsWeb3Rpc = (config?: Config) => {
  const {
    trigger: createIssueToken,
    reset: resetCreateIssueToken,
    isMutating: isCreatingToken,
    data: createTokenHash,
    error: errorCreateToken,
  } = useSWRMutation(
    config ? [config, 'createIssueToken'] : null,
    async ([cfg], { arg }: { arg: CreateTokenArgs }) => {
      const chainId = 8453;

      let txData: Array<{
        target: `0x${string}`;
        value: number;
        data: `0x${string}`;
      }> = [];

      if (['utility', 'credits'].includes(arg.type)) {
        txData = [
          {
            target: regularTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: regularTokenFactoryAbi,
              functionName: 'deployToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply),
                arg.transferable,
                arg.isVotingToken,
              ],
            }),
          },
        ];
      } else if (arg.type === 'ownership') {
        txData = [
          {
            target: ownershipTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: ownershipTokenFactoryAbi,
              functionName: 'deployOwnershipToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply),
                arg.transferable,
              ],
            }),
          },
        ];
      } else if (arg.type === 'voice') {
        if (
          typeof arg.decayPercentage !== 'number' ||
          typeof arg.decayInterval !== 'number'
        ) {
          throw new Error(
            'Missing decayPercentage or decayInterval for voice token',
          );
        }

        txData = [
          {
            target: decayingTokenFactoryAddress[chainId],
            value: 0,
            data: encodeFunctionData({
              abi: decayingTokenFactoryAbi,
              functionName: 'deployDecayingToken',
              args: [
                BigInt(arg.spaceId),
                arg.name,
                arg.symbol,
                BigInt(arg.maxSupply),
                arg.transferable,
                arg.isVotingToken,
                BigInt(arg.decayPercentage), // TODO: temp for MVP
                BigInt(arg.decayInterval), // TODO: temp for MVP
              ],
            }),
          },
        ];
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
    data: createdToken,
    isLoading: isLoadingTokenFromTx,
    error: errorWaitTokenFromTx,
  } = useSWR(
    createTokenHash ? [createTokenHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    createIssueToken,
    resetCreateIssueToken,
    isCreatingToken,
    createTokenHash,
    errorCreateToken,
    createdToken,
    isLoadingTokenFromTx,
    errorWaitTokenFromTx,
  };
};
