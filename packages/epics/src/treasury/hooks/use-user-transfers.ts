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

  const { data, isLoading, error } = useSWR(
    personSlug && jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      try {
        const res = await fetch(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch transactions: ${res.statusText}`);
        }
        return await res.json();
      } catch (err) {
        console.error('Fetch error:', err);
        throw err;
      }
    },
    { refreshInterval },
  );

  return {
    transfers: (data as TransferWithEntity[]) || [],
    isLoading,
    error,
  };
};
