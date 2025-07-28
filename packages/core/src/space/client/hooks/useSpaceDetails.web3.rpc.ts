'use client';

import useSWR from 'swr';
import { getSpaceDetails } from '@hypha-platform/core/client';

export const useSpaceDetailsWeb3Rpc = ({
  spaceIds,
}: {
  spaceIds: number[];
}) => {
  const { data, isLoading, error } = useSWR(
    [spaceIds, 'spaceDetails'],
    async ([spaceIds]) =>
      getSpaceDetails({
        spaceIds: spaceIds.map((id) => BigInt(id)),
      }),
    { revalidateOnFocus: true },
  );

  return {
    spaceDetails: data,
    isLoading,
    error,
  };
};
