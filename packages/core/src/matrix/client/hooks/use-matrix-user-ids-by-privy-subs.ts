'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

import { getMatrixUserIdsByPrivySubsAction } from '../../server/actions';

/** Stable fallback — `data ?? {}` was a new object each render and broke referential equality downstream. */
const EMPTY_SUB_TO_MATRIX: Record<string, string> = {};

export interface UseMatrixUserIdsByPrivySubsInput {
  /** Privy `sub` values from Hypha `Person.sub` (omit empty). */
  privySubs?: string[];
}

/**
 * Batch-resolve Hypha person subs → Matrix MXIDs via `matrix_user_links`
 * (same source as timeline profile resolution).
 */
export const useMatrixUserIdsByPrivySubs = ({
  privySubs,
}: UseMatrixUserIdsByPrivySubsInput) => {
  const { jwt, isLoadingJwt } = useJwt();

  const environment = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return determineEnvironment(window.location.href);
  }, []);

  const uniqueSorted = React.useMemo(() => {
    const raw = privySubs ?? [];
    return [...new Set(raw.map((s) => s.trim()).filter(Boolean))].sort();
  }, [privySubs]);

  const arg =
    isLoadingJwt || uniqueSorted.length === 0 || !environment || !jwt
      ? null
      : { privyUserIds: uniqueSorted, environment };

  const { data, error, isLoading } = useSWR(
    arg ? [arg, 'matrixUserIdsByPrivySubs'] : null,
    async ([a]) => {
      const rows = await getMatrixUserIdsByPrivySubsAction(a, {
        authToken: jwt ?? undefined,
      });
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.privyUserId] = row.matrixUserId;
      }
      return map;
    },
    /** Avoid flashing Privy/Matrix technical locals when JWT refreshes or focus revalidation races. */
    { keepPreviousData: true },
  );

  return {
    subToMatrixUserId: data ?? EMPTY_SUB_TO_MATRIX,
    isLoading: isLoadingJwt || isLoading,
    error,
  };
};
