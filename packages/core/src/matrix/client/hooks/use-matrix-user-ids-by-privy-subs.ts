'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

import { getMatrixUserIdsByPrivySubsAction } from '../../server/actions';

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
  );

  return {
    subToMatrixUserId: data ?? {},
    isLoading: isLoadingJwt || isLoading,
    error,
  };
};
