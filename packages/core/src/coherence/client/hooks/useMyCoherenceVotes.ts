'use client';

import useSWR from 'swr';
import { getMyCoherenceVotesForCoherenceIdsAction } from '../../server/actions';

export function useMyCoherenceVotesForSpace(
  authToken: string | null | undefined,
  spaceId: number | undefined,
  coherenceIds: number[],
) {
  const sortedKey = [...coherenceIds].sort((a, b) => a - b).join(',');

  const { data, error, isLoading, mutate } = useSWR(
    authToken && spaceId != null && sortedKey.length > 0
      ? ['coherenceVotes', authToken, spaceId, sortedKey]
      : null,
    async () =>
      getMyCoherenceVotesForCoherenceIdsAction(
        { coherenceIds },
        { authToken: authToken ?? undefined },
      ),
  );

  return {
    votes: data ?? {},
    isLoading,
    error,
    mutate,
  };
}
