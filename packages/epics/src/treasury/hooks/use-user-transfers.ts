'use client';
import React from 'react';
import useSWR from 'swr';
import { TransferWithPerson } from './types';

export const useUserTransfers = ({
  sort,
  refreshInterval = 10000,
  personSlug,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  personSlug?: string;
}) => {
  const endpoint = React.useMemo(() => {
    if (!personSlug) return '';
    return `/api/v1/people/${personSlug}/transactions`;
  }, [personSlug]);

  const { data, isLoading, error } = useSWR(
    personSlug ? [endpoint, sort] : null,
    async ([endpoint, sort]) => {
      const url = new URL(endpoint, window.location.origin);
      if (sort?.sort) {
        url.searchParams.set('sort', sort.sort);
      }

      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
      }
      return await res.json();
    },
    { refreshInterval },
  );

  return {
    transfers: data as TransferWithPerson[],
    isLoading,
    error,
  };
};
