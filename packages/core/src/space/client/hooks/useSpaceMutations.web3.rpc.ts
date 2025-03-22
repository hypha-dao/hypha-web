import useSWRMutation from 'swr/mutation';
import { Config, writeContract } from '@wagmi/core';
import {
  createSpaceWeb3,
  CreateSpaceWeb3Input,
  getSpaceFromLogs,
  mapToCreateSpaceWeb3Input,
} from '../web3';
import { schemaCreateSpaceWeb3 } from '@core/space/validation';
import useSWR from 'swr';
import { waitForSpaceTransactionReceipt } from '../web3/dao-space-factory/wait-for-space-transactionReceipt';
import { z } from 'zod';

export const useSpaceMutationsWeb3Rpc = (config: Config) => {
  const {
    trigger: createSpaceMutation,
    reset: resetCreateSpaceMutation,
    isMutating: isCreatingSpace,
    data: createSpaceHash,
    error: errorCreateSpace,
  } = useSWRMutation(
    config ? [config, 'createSpaceWeb3'] : null,
    async (
      [config],
      { arg }: { arg: z.infer<typeof schemaCreateSpaceWeb3> },
    ) => {
      const input = schemaCreateSpaceWeb3.parse(arg);
      const args = mapToCreateSpaceWeb3Input(input);
      return writeContract(config, createSpaceWeb3(args));
    },
  );

  const {
    data: createdSpace,
    isLoading: isLoadingSpaceFromTransaction,
    error: errorWaitSpaceFromTransaction,
  } = useSWR(
    createSpaceHash ? [createSpaceHash, 'waitFor'] : null,
    async ([hash]) => {
      const { logs } = await waitForSpaceTransactionReceipt({ hash });
      return getSpaceFromLogs(logs);
    },
  );

  return {
    createSpace: createSpaceMutation,
    resetCreateSpaceMutation,
    isCreatingSpace,
    isLoadingSpaceFromTransaction,
    errorCreateSpace,
    errorWaitSpaceFromTransaction,
    createSpaceHash,
    createdSpace,
  };
};
