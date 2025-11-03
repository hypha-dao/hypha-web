'use client';

import useSWR from 'swr';
import { getHasSpacePaid, publicClient } from '@hypha-platform/core/client';

export function useHasSpacePaid({ spaceId }: { spaceId: bigint }) {
  const {
    data: hasSpacePaid,
    isLoading,
    error,
  } = useSWR(
    spaceId ? [spaceId, 'getHasSpacePaid'] : null,
    async ([spaceId]) =>
      publicClient.readContract(getHasSpacePaid({ spaceId })),
    { revalidateOnFocus: true },
  );

  return {
    hasSpacePaid,
    isLoading,
    error,
  };
}
