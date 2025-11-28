'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';
import { removeMember } from '../web3/dao-space-factory/remove-member';

type RemoveMemberArgs = {
  spaceId: number;
  memberAddress: `0x${string}`;
};

export const useRemoveMemberWeb3Rpc = () => {
  const { client } = useSmartWallets();

  const {
    trigger: removeMemberMutation,
    reset: resetRemoveMemberMutation,
    isMutating: isRemovingMember,
    data: removeMemberHash,
    error: errorRemoveMember,
  } = useSWRMutation<`0x${string}`, any, string[], RemoveMemberArgs>(
    ['removeMemberWeb3'],
    async (_key, { arg }) => {
      if (!client) throw new Error('Smart wallet client not available');
      return await client.writeContract(
        removeMember({
          spaceId: BigInt(arg.spaceId),
          memberAddress: arg.memberAddress,
        }),
      );
    },
  );
  return {
    removeMember: removeMemberMutation,
    resetRemoveMemberMutation,
    isRemovingMember,
    removeMemberHash,
    errorRemoveMember,
  };
};
