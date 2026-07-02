'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

import { getMatrixUserIdsByPersonIdsAction } from '../../server/actions';

/** Stable fallback — new object each render breaks referential equality downstream. */
const EMPTY_PERSON_TO_MATRIX: Record<number, string> = {};
const lastPersonToMatrixByKey = new Map<string, Record<number, string>>();

function personIdsCacheKey(ids: number[]): string {
  return ids.join('\u0000');
}

export interface UseMatrixUserIdsByPersonIdsInput {
  /** Hypha `Person.id` values from the space roster. */
  personIds?: number[];
}

/**
 * Batch-resolve space roster person ids → Matrix MXIDs via `people.sub` +
 * `matrix_user_links` (server-side; subs are not exposed on the public roster).
 */
export const useMatrixUserIdsByPersonIds = ({
  personIds,
}: UseMatrixUserIdsByPersonIdsInput) => {
  const { jwt, isLoadingJwt } = useJwt();

  const environment = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return determineEnvironment(window.location.href);
  }, []);

  const uniqueSorted = React.useMemo(() => {
    const raw = personIds ?? [];
    return [...new Set(raw.filter((id) => Number.isFinite(id) && id > 0))].sort(
      (a, b) => a - b,
    );
  }, [personIds]);

  const arg =
    isLoadingJwt || uniqueSorted.length === 0 || !environment || !jwt
      ? null
      : { personIds: uniqueSorted, environment };

  const { data, error, isLoading } = useSWR(
    arg ? [arg, 'matrixUserIdsByPersonIds'] : null,
    async ([a]) => {
      const rows = await getMatrixUserIdsByPersonIdsAction(a, {
        authToken: jwt ?? undefined,
      });
      const map: Record<number, string> = {};
      for (const row of rows) {
        map[row.personId] = row.matrixUserId;
      }
      lastPersonToMatrixByKey.set(personIdsCacheKey(a.personIds), map);
      return map;
    },
    { keepPreviousData: true },
  );

  const cachedMap =
    uniqueSorted.length > 0
      ? lastPersonToMatrixByKey.get(personIdsCacheKey(uniqueSorted))
      : undefined;

  return {
    personIdToMatrixUserId: data ?? cachedMap ?? EMPTY_PERSON_TO_MATRIX,
    isLoading: isLoadingJwt || isLoading,
    error,
  };
};
