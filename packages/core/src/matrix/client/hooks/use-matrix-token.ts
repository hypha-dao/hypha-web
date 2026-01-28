'use client';

import { useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

export interface MatrixTokenData {
  accessToken: string;
  userId: string;
  homeserverUrl: string;
  deviceId?: string;
  elementConfig: {
    defaultRoomId?: string;
    theme: string;
  };
}

export const useMatrixToken = () => {
  const [error, setError] = React.useState<string | null>(null);
  const { jwt, isLoadingJwt } = useJwt();

  const endpoint = isLoadingJwt ? null : '/api/matrix/token';

  const { data: matrixToken, isLoading } = useSWR(
    [endpoint, 'getMatrixToken'],
    async ([endpoint]) => {
      if (!endpoint) {
        return undefined;
      }
      try {
        const response = await fetch(endpoint, {
          headers: {
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : undefined),
          },
        });
        if (!response.ok) {
          return undefined;
        }
        const data = await response.json();
        return data as MatrixTokenData;
      } catch (err) {
        console.warn('Cannot get Matrix token:', err);
        setError(err instanceof Error ? err.message : `${err}`);
        return undefined;
      }
    },
    {
      errorRetryInterval: 2000,
    },
  );

  return {
    isLoading,
    matrixToken,
    error,
  };
};
