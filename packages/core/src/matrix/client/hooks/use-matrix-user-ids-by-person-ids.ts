'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

import { getMatrixUserIdsByPersonIdsAction } from '../../server/actions';

/** Stable fallback — new object each render breaks referential equality downstream. */
const EMPTY_PERSON_TO_MATRIX: Record<number, string> = {};

/** One-shot person-id → MXID lookup for create/update follow-up work. */
export async function resolveMatrixUserIdsByPersonIds({
  personIds,
  authToken,
}: {
  personIds: readonly number[];
  authToken?: string | null;
}): Promise<Record<number, string>> {
  const unique = [
    ...new Set(personIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (unique.length === 0 || !authToken) return {};
  if (typeof window === 'undefined') return {};
  const environment = determineEnvironment(window.location.href);
  if (!environment) return {};
  const rows = await getMatrixUserIdsByPersonIdsAction(
    { personIds: unique, environment },
    { authToken },
  );
  const map: Record<number, string> = {};
  for (const row of rows) {
    map[row.personId] = row.matrixUserId;
  }
  return map;
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
      return map;
    },
    { keepPreviousData: true },
  );

  return {
    personIdToMatrixUserId: data ?? EMPTY_PERSON_TO_MATRIX,
    isLoading: isLoadingJwt || isLoading,
    error,
  };
};
