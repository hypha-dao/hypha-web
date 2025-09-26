'use client';

import {
  publicClient,
  getDelegatesForSpace,
} from '@hypha-platform/core/client';
import useSWR from 'swr';

export const useDelegatesForSpaces = ({ spaceId }: { spaceId: bigint }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'delegates'],
    async ([spaceId]) =>
      publicClient.readContract(getDelegatesForSpace({ spaceId })),
    { revalidateOnFocus: true },
  );

  return {
    data,
    isLoading,
    error,
  };
};
