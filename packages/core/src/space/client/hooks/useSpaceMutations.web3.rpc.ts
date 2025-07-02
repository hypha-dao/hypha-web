'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { z } from 'zod';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  createSpaceWeb3,
  getSpaceFromLogs,
  mapToCreateSpaceWeb3Input,
} from '../web3';
import {
  schemaCreateSpaceWeb3,
  publicClient,
} from '@hypha-platform/core/client';

export const useSpaceMutationsWeb3Rpc = () => {
  const { client } = useSmartWallets();

  const {
    trigger: createSpaceMutation,
    reset: resetCreateSpaceMutation,
    isMutating: isCreatingSpace,
    data: createSpaceHash,
    error: errorCreateSpace,
  } = useSWRMutation(
    'createSpaceWeb3',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpaceWeb3> }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const input = schemaCreateSpaceWeb3.parse(arg);
      const args = mapToCreateSpaceWeb3Input(input);

      const txHash = await client.writeContract(createSpaceWeb3(args));
      return txHash;
    },
  );

  const {
    data: createdSpace,
    isLoading: isLoadingSpaceFromTransaction,
    error: errorWaitSpaceFromTransaction,
  } = useSWR(
    createSpaceHash ? [createSpaceHash, 'waitFor'] : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
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
