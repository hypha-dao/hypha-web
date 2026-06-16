'use client';

import { useJwt } from '@hypha-platform/core/client';
import React from 'react';
import useSWR from 'swr';

export interface MatrixTokenData {
  accessToken: string;
  userId: string;
  homeserverUrl: string;
  deviceId?: string;
  /** Seconds until access token expiry when returned by `/api/matrix/token`. */
  expiresInSec?: number;
  elementConfig: {
    defaultRoomId?: string;
    theme: string;
  };
}

export const useMatrixToken = () => {
  const [error, setError] = React.useState<string | null>(null);
  const { jwt, isLoadingJwt } = useJwt();

  const endpoint = isLoadingJwt ? null : '/api/matrix/token';
  const swrKey =
    endpoint && jwt ? ([endpoint, jwt, 'getMatrixToken'] as const) : null;

  const {
    data: matrixToken,
    isLoading,
    mutate: mutateMatrixToken,
  } = useSWR(
    swrKey,
    async ([endpoint, authToken]) => {
      if (!endpoint || !authToken) {
        return undefined;
      }
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn(
            `Matrix token request failed: ${response.status} - ${errorText}`,
          );
          throw new Error(
            `Request failed: ${response.status} ${
              response.statusText
            } - ${errorText.slice(0, 300)}`,
          );
        }
        const data = await response.json();
        if (
          !data ||
          typeof data.accessToken !== 'string' ||
          typeof data.userId !== 'string' ||
          typeof data.homeserverUrl !== 'string' ||
          !data.elementConfig ||
          typeof data.elementConfig !== 'object' ||
          typeof data.elementConfig.theme !== 'string' ||
          (data.expiresInSec != null && typeof data.expiresInSec !== 'number')
        ) {
          throw new Error(
            'Invalid Matrix token response: missing required fields, invalid elementConfig, or invalid expiresInSec',
          );
        }
        return data as MatrixTokenData;
      } catch (err) {
        console.warn('Cannot get Matrix token:', err);
        throw err;
      }
    },
    {
      errorRetryInterval: 2000,
      onSuccess: () => {
        setError(null);
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : `${err}`);
      },
    },
  );

  return {
    isLoading: isLoading || isLoadingJwt,
    matrixToken,
    error,
    refreshMatrixToken: mutateMatrixToken,
  };
};
