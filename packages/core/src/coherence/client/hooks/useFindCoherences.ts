'use client';

import useSWR from 'swr';
import { getAllCoherences } from '../../server/web3';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherenceStatus } from '../../coherence-statuses';

export const useFindCoherences = ({
  spaceId,
  search,
  type,
  tags,
  status,
  includeArchived,
}: {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  status?: CoherenceStatus;
  includeArchived?: boolean;
}) => {
  const {
    data: coherences,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    [
      { spaceId, search, type, tags, status, includeArchived },
      'getAllCoherences',
    ],
    async ([{ search, type, tags, status, includeArchived }]) =>
      await getAllCoherences({
        spaceId,
        search,
        type,
        tags,
        status,
        includeArchived,
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
