'use client';

import useSWRMutation from 'swr/mutation';
import { Config, writeContract } from '@wagmi/core';
import {
  createProposal,
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
} from '../web3';
import { schemaCreateProposalWeb3 } from '@core/governance/validation';
import useSWR from 'swr';
import { publicClient } from '@core/common/web3/public-client';
import { encodeFunctionData } from 'viem';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import {
  CreateChangeEntryMethodInput,
  EntryMethodType,
} from '@core/governance/types';

export const useChangeEntryMethodMutationsWeb3Rpc = (config?: Config) => {
  const {
    trigger: createChangeEntryMethodMutation,
    reset: resetCreateChangeEntryMethodMutation,
    isMutating: isCreatingChangeEntryMethod,
    data: createChangeEntryMethodHash,
    error: errorCreateChangeEntryMethod,
  } = useSWRMutation(
    config ? [config, 'createProposal'] : null,
    async (
      [config],
      { arg }: { arg: { spaceId: number; joinMethod: number } },
    ) => {
      const transactions = [];
      switch (arg.joinMethod) {
        case EntryMethodType.OPEN_ACCESS:
          transactions.push({
            target: daoSpaceFactoryImplementationAddress[8453],
            value: 0,
            data: encodeFunctionData({
              abi: daoSpaceFactoryImplementationAbi,
              functionName: 'changeEntryMethod',
              args: [BigInt(arg.spaceId), BigInt(arg.joinMethod)],
            }),
          });
          break;
        case EntryMethodType.INVITE_ONLY:
          transactions.push({
            target: daoSpaceFactoryImplementationAddress[8453],
            value: 0,
            data: encodeFunctionData({
              abi: daoSpaceFactoryImplementationAbi,
              functionName: 'changeEntryMethod',
              args: [BigInt(arg.spaceId), BigInt(arg.joinMethod)],
            }),
          });
          break;
        case EntryMethodType.TOKEN_BASED:
          transactions.push({
            target: daoSpaceFactoryImplementationAddress[8453],
            value: 0,
            data: encodeFunctionData({
              abi: daoSpaceFactoryImplementationAbi,
              functionName: 'changeEntryMethod',
              args: [BigInt(arg.spaceId), BigInt(arg.joinMethod)],
            }),
          });
          break;
        default:
          break;
      }

      const input = {
        spaceId: arg.spaceId,
        duration: 86400,
        transactions,
      };
      console.log(input);
      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const args = mapToCreateProposalWeb3Input(parsedInput);
      return writeContract(config, createProposal(args));
    },
  );

  const {
    data: createdChangeEntryMethod,
    isLoading: isLoadingChangeEntryMethodFromTransaction,
    error: errorWaitChangeEntryMethodFromTransaction,
  } = useSWR(
    createChangeEntryMethodHash
      ? [createChangeEntryMethodHash, 'waitFor']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({
        hash,
      });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createChangeEntryMethod: createChangeEntryMethodMutation,
    resetCreateChangeEntryMethodMutation,
    isCreatingChangeEntryMethod,
    isLoadingChangeEntryMethodFromTransaction,
    errorCreateChangeEntryMethod,
    errorWaitChangeEntryMethodFromTransaction,
    createChangeEntryMethodHash,
    createdChangeEntryMethod,
  };
};
