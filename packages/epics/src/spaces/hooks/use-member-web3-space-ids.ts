'use client';

import useSWR from 'swr';
import { Address } from '@hypha-platform/core/client';
import {
  getMemberSpaces,
  publicClient,
  getSpacesForDelegate,
} from '@hypha-platform/core/client';

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
    personAddress ? [personAddress, 'getMemberAndDelegatedSpaces'] : null,
    async ([address]) => {
      const [memberSpaces, delegatedSpaces] = await Promise.all([
        publicClient.readContract(getMemberSpaces({ memberAddress: address })),
        publicClient.readContract(
          getSpacesForDelegate({ user: address as `0x${string}` }),
        ),
      ]);
      const allSpaces = Array.from(
        new Set([...(memberSpaces ?? []), ...(delegatedSpaces ?? [])]),
      );
      return allSpaces;
    },
    { revalidateOnFocus: true },
  );

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
