'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { undelegate } from '../web3';
import useSWRMutation from 'swr/mutation';

type UndelegateArgs = {
  spaceId: number;
};

export const useUndelegateWeb3Rpc = () => {
  const { client } = useSmartWallets();

  const {
    trigger: undelegateMutation,
    reset: resetUndelegateMutation,
    isMutating: isUndelegating,
    data: undelegateHash,
    error: errorUndelegate,
  } = useSWRMutation<`0x${string}`, any, string[], UndelegateArgs>(
    ['delegateWeb3'],
    async (_key, { arg }) => {
      console.log('undelegate');
      if (!client) throw new Error('Smart wallet client not available');
      return await client.writeContract(
        undelegate({
          spaceId: BigInt(arg.spaceId),
        }),
      );
    },
  );

  return {
    undelegate: undelegateMutation,
    resetUndelegateMutation,
    isUndelegating,
    undelegateHash,
    errorUndelegate,
  };
};
