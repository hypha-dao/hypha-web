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

  console.log(
    `[DEBUG useMatrixToken] render — isLoadingJwt=${isLoadingJwt} hasJwt=${!!jwt} endpoint=${endpoint}`,
  );

  const { data: matrixToken, isLoading } = useSWR(
    [endpoint, !!jwt, 'getMatrixToken'],
    async ([endpoint]) => {
      const authToken = jwt;
      console.log(
        `[DEBUG useMatrixToken] SWR fetcher called — endpoint=${endpoint} hasAuthToken=${!!authToken}`,
      );
      if (!endpoint || !authToken) {
        console.log(
          `[DEBUG useMatrixToken] Skipping fetch — endpoint=${endpoint} authToken=${!!authToken}`,
        );
        return undefined;
      }
      const fetchStart = Date.now();
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        console.log(
          `[DEBUG useMatrixToken] Fetch response — status=${
            response.status
          } ok=${response.ok} elapsed=${Date.now() - fetchStart}ms`,
        );
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn(
            `[DEBUG useMatrixToken] FETCH FAILED — status=${
              response.status
            } statusText=${response.statusText} body=${errorText.slice(
              0,
              400,
            )}`,
          );
          throw new Error(
            `Request failed: ${response.status} ${
              response.statusText
            } - ${errorText.slice(0, 300)}`,
          );
        }
        const data = await response.json();
        const isValid =
          data &&
          typeof data.accessToken === 'string' &&
          typeof data.userId === 'string' &&
          typeof data.homeserverUrl === 'string' &&
          data.elementConfig &&
          typeof data.elementConfig === 'object' &&
          typeof data.elementConfig.theme === 'string';
        console.log(
          `[DEBUG useMatrixToken] Response parsed — isValid=${isValid} userId=${
            data?.userId ?? 'missing'
          } homeserverUrl=${data?.homeserverUrl ?? 'missing'}`,
        );
        if (!isValid) {
          throw new Error(
            'Invalid Matrix token response: missing required fields or elementConfig',
          );
        }
        return data as MatrixTokenData;
      } catch (err) {
        console.warn(
          '[DEBUG useMatrixToken] Cannot get Matrix token:',
          err instanceof Error ? err.stack ?? err.message : err,
        );
        throw err;
      }
    },
    {
      errorRetryInterval: 2000,
      onSuccess: () => {
        console.log('[DEBUG useMatrixToken] Token fetch succeeded');
        setError(null);
      },
      onError: (err: unknown) => {
        console.warn(
          '[DEBUG useMatrixToken] Token fetch error (stored in state):',
          err,
        );
        setError(err instanceof Error ? err.message : `${err}`);
      },
    },
  );

  return {
    isLoading: isLoading || isLoadingJwt,
    matrixToken,
    error,
  };
};
