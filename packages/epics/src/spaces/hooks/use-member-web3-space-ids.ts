'use client';

import useSWR from 'swr';
import { getMemberSpaces } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { publicClient } from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIds() {
  const { user } = useAuthentication();
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    user?.wallet?.address ? [user.wallet.address, 'getMemberSpaces'] : null,
    async ([address]) =>
      publicClient.readContract(getMemberSpaces({ memberAddress: address })),
    { revalidateOnFocus: true },
  );

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
