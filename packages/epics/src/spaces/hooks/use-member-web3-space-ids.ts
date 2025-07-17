'use client';

import useSWR from 'swr';
import { Address } from '@hypha-platform/core/client';
import { getMemberSpaces } from '@hypha-platform/core/client';
import { publicClient } from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIds({
  personAddress,
}: {
  personAddress: Address | undefined;
}) {
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    personAddress ? [personAddress, 'getMemberSpaces'] : null,
    async ([address]) =>
      publicClient.readContract(
        getMemberSpaces({ memberAddress: address }),
      ),
    { revalidateOnFocus: true },
  );

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
