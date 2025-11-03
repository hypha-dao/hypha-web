'use client';

import useSWR from 'swr';
import {
  getSpaceTokenRequirements,
  publicClient,
} from '@hypha-platform/core/client';

export function useSpaceTokenRequirements({ spaceId }: { spaceId?: bigint }) {
  const {
    data: requirements,
    isLoading,
    error,
  } = useSWR(
    spaceId ? [spaceId, 'getSpaceTokenRequirements'] : null,
    async ([spaceId]) =>
      publicClient.readContract(getSpaceTokenRequirements({ spaceId })),
    { revalidateOnFocus: true },
  );

  return {
    requirements,
    isLoading,
    error,
  };
}
