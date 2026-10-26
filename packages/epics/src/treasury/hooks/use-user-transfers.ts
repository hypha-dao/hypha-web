'use client';
import React from 'react';
import useSWR from 'swr';
import { TransferWithEntity } from './types';
import { useJwt } from '@hypha-platform/core/client';
import { buildUserTransfersEndpoint } from './build-user-transfers-endpoint';

export { buildUserTransfersEndpoint } from './build-user-transfers-endpoint';

export const useUserTransfers = ({
  sort,
  refreshInterval = 10000,
  personSlug,
  token,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  personSlug?: string;
  token?: string;
}) => {
  const { jwt } = useJwt();
  const waitingForAuth = Boolean(personSlug) && !jwt;

  const endpoint = React.useMemo(() => {
    if (!personSlug) return '';
    return buildUserTransfersEndpoint({
      personSlug,
      sort: sort?.sort,
      token,
    });
  }, [personSlug, sort, token]);

  const { data, isLoading, error, mutate } = useSWR(
    personSlug && jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      // Any non-2xx (400 included) must surface as an error, not an empty list.
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.status}`);
      }
      const payload = await res.json();
      if (!Array.isArray(payload)) {
        throw new Error('Failed to fetch transactions: invalid payload');
      }
      return payload as TransferWithEntity[];
    },
    {
      refreshInterval,
      keepPreviousData: true,
      errorRetryCount: 3,
      shouldRetryOnError: true,
    },
  );

  return {
    transfers: error ? [] : data || [],
    isLoading: isLoading || waitingForAuth,
    error,
    retry: mutate,
  };
};
