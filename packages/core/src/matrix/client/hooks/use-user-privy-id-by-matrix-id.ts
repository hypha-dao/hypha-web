'use client';

import { determineEnvironment, useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';
import { getLinkByMatrixUserId } from '../../server/web3/get-link-by-matrix-user-id';

export interface UseUserPrivyIdByMatrixIdInput {
  matrixUserId: string;
}

export const useUserPrivyIdByMatrixId = ({
  matrixUserId,
}: UseUserPrivyIdByMatrixIdInput) => {
  const [error, setError] = React.useState<string | null>(null);
  const { jwt, isLoadingJwt } = useJwt();

  const environment = determineEnvironment(window.location.href);
  const arg = isLoadingJwt ? null : { matrixUserId, environment };

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
        const response = await getLinkByMatrixUserId({
          matrixUserId,
          environment,
        });
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
    isLoading,
    privyUserId,
    error,
  };
};
