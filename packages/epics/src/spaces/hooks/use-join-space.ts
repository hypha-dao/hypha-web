'use client';

import {
  isMember as isMemberConfig,
  publicClient,
  useJoinSpaceWeb3Rpc,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';
import React from 'react';

export const useJoinSpace = ({ spaceId }: { spaceId?: number }) => {
  const { user } = useAuthentication();
  const { joinSpace: joinSpaceWeb3, isJoiningSpace } = useJoinSpaceWeb3Rpc({
    spaceId: spaceId as number,
  });

  const joinSpace = React.useCallback(async () => {
    if (!Number.isSafeInteger(spaceId) || (spaceId as number) < 0) {
      throw new Error('spaceId is required to join a space');
    }
    return joinSpaceWeb3();
  }, [joinSpaceWeb3, spaceId]);

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
    joinSpace,
    revalidateIsMember: mutate,
  };
};
