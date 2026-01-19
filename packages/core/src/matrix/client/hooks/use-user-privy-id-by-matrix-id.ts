'use client';

import { useJwt } from '@hypha-platform/core/client';
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

  const arg = isLoadingJwt ? null : matrixUserId;

  const { data: privyUserId, isLoading } = useSWR(
    [jwt ? arg : null, 'getLinkByMatrixUserId'],
    async ([matrixUserId]) => {
      if (!matrixUserId) {
        return undefined;
      }
      try {
        const response = await getLinkByMatrixUserId({ matrixUserId });
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
