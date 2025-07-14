'use client';

import useSWR from 'swr';
import { getMemberSpaces } from '@core/space';
import { publicClient } from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIdsByWallet({
  walletAddress,
}: {
  walletAddress: `0x${string}` | undefined;
}) {
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    walletAddress ? [walletAddress, 'getMemberSpaces'] : null,
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
