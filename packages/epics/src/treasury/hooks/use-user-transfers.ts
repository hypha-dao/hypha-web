'use client';
import React from 'react';
import useSWR from 'swr';
import { TransferWithPerson } from './types';
import { useJwt } from '@hypha-platform/core/client';

export const useUserTransfers = ({
  sort,
  refreshInterval = 10000,
  personSlug,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  personSlug?: string;
}) => {
  const { jwt } = useJwt();
  const endpoint = React.useMemo(() => {
    if (!personSlug) return '';
    return `/api/v1/people/${personSlug}/transactions`;
  }, [personSlug]);

  const { data, isLoading, error } = useSWR(
    personSlug && jwt ? [endpoint, sort, jwt] : null,
    async ([endpoint, sort, jwt]) => {
      const url = new URL(endpoint, window.location.origin);
      if (sort?.sort) {
        url.searchParams.set('sort', sort.sort);
      }

      return fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch transactions: ${res.statusText}`);
        }
        return await res.json();
      });
    },
    { refreshInterval },
  );

  return {
    transfers: data as TransferWithPerson[],
    isLoading,
    error,
  };
};
