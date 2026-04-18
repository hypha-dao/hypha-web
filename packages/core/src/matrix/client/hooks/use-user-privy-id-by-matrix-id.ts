'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';
import { getLinkByMatrixUserIdAction } from '../../server/actions';

export interface UseUserPrivyIdByMatrixIdInput {
  /** When omitted or empty, no request is made (safe for conditional resolution). */
  matrixUserId?: string;
}

export const useUserPrivyIdByMatrixId = ({
  matrixUserId,
}: UseUserPrivyIdByMatrixIdInput) => {
  const [error, setError] = React.useState<string | null>(null);
  const { jwt, isLoadingJwt } = useJwt();

  const environment = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return determineEnvironment(window.location.href);
  }, []);
  const trimmedId = matrixUserId?.trim();
  const arg =
    isLoadingJwt || !trimmedId
      ? null
      : { matrixUserId: trimmedId, environment };

  const { data: privyUserId, isLoading } = useSWR(
    [jwt ? arg : null, 'getLinkByMatrixUserId'],
    async ([arg]) => {
      if (!arg) {
        return undefined;
      }
      const { matrixUserId, environment } = arg;
      if (!matrixUserId || !environment) {
        return undefined;
      }
      try {
        const response = await getLinkByMatrixUserIdAction(
          { matrixUserId, environment },
          { authToken: jwt ?? undefined },
        );
        if (!response) {
          return undefined;
        }
        const data = response.privyUserId;
        return data;
      } catch (err) {
        console.warn('Cannot get Privy user ID:', err);
        setError(err instanceof Error ? err.message : `${err}`);
        return undefined;
      }
    },
  );

  return {
    isLoading: isLoadingJwt || isLoading,
    privyUserId,
    error,
  };
};
