'use client';

import { publicClient, getDelegate } from '@hypha-platform/core/client';
import useSWR from 'swr';

export const useGetDelegate = ({
  user,
  spaceId,
}: {
  user?: `0x${string}`;
  spaceId?: bigint;
}) => {
  const { data, isLoading, error } = useSWR(
    user && spaceId ? [user, spaceId, 'delegate'] : null,
    async ([user, spaceId]) =>
      publicClient.readContract(
        getDelegate({ spaceId: BigInt(spaceId), user: user as `0x${string}` }),
      ),
    { revalidateOnFocus: true },
  );

  return {
    data,
    isLoading,
    error,
  };
};
