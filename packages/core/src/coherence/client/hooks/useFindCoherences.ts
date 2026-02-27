'use client';

import useSWR from 'swr';
import { getAllCoherences } from '../../server/web3';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';

export interface CoherenceQuery {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
}

export const useFindCoherences = ({
  spaceId,
  search,
  type,
  tags,
  priority,
  includeArchived,
  orderBy,
}: {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: string;
}) => {
  const {
    data: coherences,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    [
      { spaceId, search, type, tags, priority, includeArchived },
      'getAllCoherences',
    ],
    async ([{ search, type, tags, priority, includeArchived }]) =>
      await getAllCoherences({
        spaceId,
        search,
        type,
        tags,
        priority,
        includeArchived,
        orderBy,
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
