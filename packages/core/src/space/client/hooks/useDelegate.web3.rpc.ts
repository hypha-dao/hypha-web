'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { delegate } from '../web3';
import useSWRMutation from 'swr/mutation';

type DelegateArgs = {
  address: `0x${string}`;
  spaceId: number;
};

export const useDelegateWeb3Rpc = () => {
  const { client } = useSmartWallets();

  const {
    trigger: delegateMutation,
    reset: resetDelegateMutation,
    isMutating: isDelegating,
    data: delegateHash,
    error: errorDelegate,
  } = useSWRMutation<`0x${string}`, any, string[], DelegateArgs>(
    ['delegateWeb3'],
    async (_key, { arg }) => {
      if (!client) throw new Error('Smart wallet client not available');
      return await client.writeContract(
        delegate({
          memberAddress: arg.address,
          spaceId: BigInt(arg.spaceId),
        }),
      );
    },
  );

  return {
    delegate: delegateMutation,
    resetDelegateMutation,
    isDelegating,
    delegateHash,
    errorDelegate,
  };
};
