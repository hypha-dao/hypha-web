'use client';

import { publicClient, getDelegators } from '@hypha-platform/core/client';
import useSWR from 'swr';

export const useGetDelegators = ({
  user,
  spaceId,
}: {
  user?: `0x${string}`;
  spaceId?: bigint;
}) => {
  const { data, isLoading, error } = useSWR(
    user && spaceId ? [user, spaceId, 'delegators'] : null,
    async ([user, spaceId]) =>
      publicClient.readContract(
        getDelegators({
          spaceId: BigInt(spaceId),
          user: user as `0x${string}`,
        }),
      ),
    { revalidateOnFocus: true },
  );

  return {
    data,
    isLoading,
    error,
  };
};
