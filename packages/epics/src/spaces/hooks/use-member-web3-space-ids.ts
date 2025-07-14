'use client';

import useSWR from 'swr';
import { getMemberSpaces } from '@core/space';
import { Address, Person, publicClient } from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIds({
  person,
}: {
  person: Person | undefined;
}) {
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    person?.address ? [person?.address, 'getMemberSpaces'] : null,
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
