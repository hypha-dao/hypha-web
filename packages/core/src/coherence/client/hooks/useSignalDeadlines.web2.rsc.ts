'use client';

import useSWR from 'swr';
import type { Coherence } from '../../types';
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
      const params = new URLSearchParams({ from, to });
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/coherences/deadlines?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch signal deadlines: ${response.status}`);
      }
      const rows = (await response.json()) as Coherence[];
      return rows.map((row) => hydrateCoherenceFromApi(row));
    },
  );

  return {
    deadlines: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
