'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { joinSpace } from '../web3/dao-space-factory/join-space';
import useSWRMutation from 'swr/mutation';

export const useJoinSpaceWeb3Rpc = ({ spaceId }: { spaceId?: number }) => {
  const { client } = useSmartWallets();

  const {
    trigger: joinSpaceMutation,
    reset: resetJoinSpaceMutation,
    isMutating: isJoiningSpace,
    data: joinSpaceHash,
    error: errorJoinSpace,
  } = useSWRMutation(
    client && spaceId ? [spaceId, 'joinSpaceWeb3'] : null,
    async ([spaceId]) => {
      if (!client) throw new Error('Smart wallet client not available');
      return await client?.writeContract(
        joinSpace({ spaceId: BigInt(spaceId) }),
      );
    },
  );

  return {
    joinSpace: joinSpaceMutation,
    resetJoinSpaceMutation,
    isJoiningSpace,
    joinSpaceHash,
    errorJoinSpace,
  };
};
