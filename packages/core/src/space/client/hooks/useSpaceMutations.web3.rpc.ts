'use client';

import React from 'react';
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
import {
  resolveSmartWalletClient,
  type SmartWalletWriteClient,
} from './resolve-smart-wallet-client';

export const useSpaceMutationsWeb3Rpc = () => {
  const { client, getClientForChain } = useSmartWallets();
  const clientRef = React.useRef(client);
  const getClientForChainRef = React.useRef(getClientForChain);
  const resolvedClientRef = React.useRef<SmartWalletWriteClient | undefined>(
    undefined,
  );

  clientRef.current = client;
  getClientForChainRef.current = getClientForChain;

  const ensureSmartWalletClient = React.useCallback(async () => {
    const walletClient = await resolveSmartWalletClient({
      getClient: () => resolvedClientRef.current ?? clientRef.current,
      getClientForChain: getClientForChainRef.current,
    });
    resolvedClientRef.current = walletClient;
    return walletClient;
  }, []);

  const {
    trigger: createSpaceMutation,
    reset: resetCreateSpaceMutation,
    isMutating: isCreatingSpace,
    data: createSpaceHash,
    error: errorCreateSpace,
  } = useSWRMutation(
    'createSpaceWeb3',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpaceWeb3> }) => {
      const walletClient = await ensureSmartWalletClient();

      const input = schemaCreateSpaceWeb3.parse(arg);
      const args = mapToCreateSpaceWeb3Input(input);

      const txHash = await walletClient.writeContract(createSpaceWeb3(args));
      return txHash;
    },
  );

  const {
    data: createdSpace,
    isLoading: isLoadingSpaceFromTransaction,
    error: errorWaitSpaceFromTransaction,
  } = useSWR(
    createSpaceHash ? [createSpaceHash, 'waitFor'] : null,
    async ([hash]: [`0x${string}`, string]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getSpaceFromLogs(logs);
    },
  );

  return {
    createSpace: createSpaceMutation,
    ensureSmartWalletClient,
    resetCreateSpaceMutation,
    isCreatingSpace,
    isLoadingSpaceFromTransaction,
    errorCreateSpace,
    errorWaitSpaceFromTransaction,
    createSpaceHash,
    createdSpace,
    hasSmartWalletClient: Boolean(client || resolvedClientRef.current),
  };
};
