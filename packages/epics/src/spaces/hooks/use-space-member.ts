'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  isMember as isMemberConfig,
  publicClient,
} from '@hypha-platform/core/client';
import useSWR from 'swr';

export const useSpaceMember = ({ spaceId }: { spaceId?: number }) => {
  const { user } = useAuthentication();

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
    error,
    revalidateIsMember: mutate,
  };
};
