'use client';

import useSWR from 'swr';
import { getAllCoherences } from '../../server/web3';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';

export const useFindCoherences = ({
  search,
  type,
  tags,
}: {
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
}) => {
  const {
    data: coherences,
    isLoading,
    error,
  } = useSWR(
    [{ search, type, tags }, 'getAllCoherences'],
    async ([{ search, type, tags }]) =>
      await getAllCoherences({
        search,
        type,
        tags,
      }),
    { revalidateOnFocus: true },
  );

  return {
    coherences,
    isLoading,
    error,
  };
};
