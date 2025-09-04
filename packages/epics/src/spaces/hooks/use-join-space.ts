'use client';

import {
  isMember as isMemberConfig,
  publicClient,
  useJoinSpaceWeb3Rpc,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';

export const useJoinSpace = ({ spaceId }: { spaceId?: number }) => {
  const { user } = useAuthentication();
  const { joinSpace: joinSpaceWeb3, isJoiningSpace } = useJoinSpaceWeb3Rpc({
    spaceId: spaceId as number,
  });

  const {
    data: isMember,
    isLoading,
    error,
    mutate,
  } = useSWR(
    user?.wallet?.address && typeof spaceId === 'number'
      ? [user.wallet.address, spaceId, 'isMember']
      : null,
    async ([address, spaceId]) =>
      await publicClient.readContract(
        isMemberConfig({ spaceId: BigInt(spaceId), memberAddress: address }),
      ),
  );

  return {
    isMember,
    isLoading,
    isJoiningSpace,
    error,
    joinSpace: joinSpaceWeb3,
    revalidateIsMember: mutate,
  };
};
