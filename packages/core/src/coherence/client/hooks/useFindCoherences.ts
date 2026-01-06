'use client';

import useSWR from 'swr';
import { getAllCoherences } from '../../server/web3';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';

export const useFindCoherences = ({
  spaceId,
  search,
  type,
  tags,
}: {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
}) => {
  const {
    data: coherences,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    [{ spaceId, search, type, tags }, 'getAllCoherences'],
    async ([{ search, type, tags }]) =>
      await getAllCoherences({
        spaceId,
        search,
        type,
        tags,
      }),
    {
      refreshInterval: 5000,
      keepPreviousData: true,
      revalidateOnFocus: true,
    },
  );

  return {
    coherences,
    isLoading,
    error,
    refresh,
  };
};
