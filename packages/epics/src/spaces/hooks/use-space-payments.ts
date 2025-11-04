'use client';

import useSWR from 'swr';
import { getSpacePayments, publicClient } from '@hypha-platform/core/client';

export function useSpacePayments({ spaceId }: { spaceId: bigint }) {
  const {
    data: payments,
    isLoading,
    error,
  } = useSWR(
    spaceId ? [spaceId, 'getSpacePayments'] : null,
    async ([spaceId]) =>
      publicClient.readContract(getSpacePayments({ spaceId })),
    { revalidateOnFocus: true },
  );

  return {
    payments,
    isLoading,
    error,
  };
}
