'use client';

import useSWR from 'swr';
import { getMemberSpaces } from '@core/space';
import { Address, Person, publicClient } from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIds({
  personAddress,
}: {
  personAddress: string | undefined;
}) {
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    personAddress ? [personAddress, 'getMemberSpaces'] : null,
    async ([address]) =>
      publicClient.readContract(getMemberSpaces({ memberAddress: address as Address })),
    { revalidateOnFocus: true },
  );

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
