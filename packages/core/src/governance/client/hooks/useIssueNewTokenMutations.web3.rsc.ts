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
} from '@core/generated';

interface CreateTokenArgs {
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
  type: string;
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
      const isUtilityOrCredits = ['utility', 'credits'].includes(arg.type);
      console.log('arguments', arg)
      const txData = isUtilityOrCredits
        ? [
            {
              target: regularTokenFactoryAddress[8453],
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
          ]
        : [];
      const parsedProposal = schemaCreateProposalWeb3.parse({
        spaceId: arg.spaceId,
        duration: 86400,
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
