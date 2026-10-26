'use client';
import React from 'react';
import useSWR from 'swr';
import { TransferWithEntity } from './types';
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
    const base = `/api/v1/people/${personSlug}/transactions`;
    return sort?.sort ? `${base}?sort=${encodeURIComponent(sort.sort)}` : base;
  }, [personSlug, sort]);

  const { data, isLoading, error, mutate } = useSWR(
    personSlug && jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.status}`);
      }
      return await res.json();
    },
    {
      refreshInterval,
      keepPreviousData: true,
      errorRetryCount: 3,
    },
  );

  return {
    transfers: (data as TransferWithEntity[]) || [],
    isLoading,
    error,
    retry: mutate,
  };
};
