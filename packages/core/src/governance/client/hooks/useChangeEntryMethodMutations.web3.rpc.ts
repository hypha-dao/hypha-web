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
import { z } from 'zod';
import { publicClient } from '@core/common/web3/public-client';
import { encodeFunctionData, EncodeFunctionDataReturnType } from 'viem';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
  tokenBalanceJoinImplementationAbi,
  tokenBalanceJoinImplementationAddress,
} from '@core/generated';
import { Address, EntryMethodType, TokenBase } from '@core/governance/types';
import { transactionSchema } from '@core/governance/validation';

type TxData = z.infer<typeof transactionSchema>;

function changeEntryMethodTx(spaceId: number, joinMethod: number): TxData {
  return {
    target: daoSpaceFactoryImplementationAddress[8453],
    value: 0,
    data: encodeFunctionData({
      abi: daoSpaceFactoryImplementationAbi,
      functionName: 'changeEntryMethod',
      args: [BigInt(spaceId), BigInt(joinMethod)],
    }),
  };
}

function setTokenRequirementTx(
  spaceId: number,
  token: Address,
  amount: number,
): TxData {
  return {
    target: tokenBalanceJoinImplementationAddress[8453],
    value: 0,
    data: encodeFunctionData({
      abi: tokenBalanceJoinImplementationAbi,
      functionName: 'setTokenRequirement',
      args: [BigInt(spaceId), token, BigInt(amount)],
    }),
  };
}

export const useChangeEntryMethodMutationsWeb3Rpc = (config?: Config) => {
  const {
    trigger: createChangeEntryMethodMutation,
    reset: resetCreateChangeEntryMethodMutation,
    isMutating: isCreatingChangeEntryMethod,
    data: createChangeEntryMethodHash,
    error: errorCreateChangeEntryMethod,
  } = useSWRMutation(
    config ? [config, 'changeEntryMethod'] : null,
    async (
      [config],
      {
        arg,
      }: {
        arg: {
          spaceId: number;
          joinMethod: number;
          tokenBase?: TokenBase;
        };
      },
    ) => {
      const transactions: TxData[] = [];
      switch (arg.joinMethod) {
        case EntryMethodType.OPEN_ACCESS:
          transactions.push(changeEntryMethodTx(arg.spaceId, arg.joinMethod));
          break;
        case EntryMethodType.INVITE_ONLY:
          transactions.push(changeEntryMethodTx(arg.spaceId, arg.joinMethod));
          break;
        case EntryMethodType.TOKEN_BASED:
          transactions.push(
            setTokenRequirementTx(
              arg.spaceId,
              arg.tokenBase?.token ?? '0x0',
              arg.joinMethod ?? 0,
            ),
            changeEntryMethodTx(arg.spaceId, arg.joinMethod),
          );
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
