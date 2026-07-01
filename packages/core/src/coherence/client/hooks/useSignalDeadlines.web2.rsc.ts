'use client';

import useSWR from 'swr';
import type { Coherence } from '../../types';
import type { PaginatedResponse } from '../../../common/types';
import { hydrateCoherenceFromApi } from '../../signal-workflow';
import { useJwt } from '../../../people/client/hooks/useJwt';

export function useSignalDeadlines(
  spaceSlug?: string,
  range?: { from: string; to: string },
) {
  const { jwt } = useJwt();
  const key =
    spaceSlug && jwt && range
      ? ([spaceSlug, jwt, range.from, range.to, 'signal-deadlines'] as const)
      : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([slug, token, from, to]) => {
      const params = new URLSearchParams({
        from,
        to,
        page: '1',
        pageSize: '500',
      });
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug,
        )}/coherences/deadlines?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch signal deadlines: ${response.status}`);
      }
      const payload = (await response.json()) as PaginatedResponse<Coherence>;
      return payload.data.map((row) => hydrateCoherenceFromApi(row));
    },
  );

  return {
    deadlines: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
