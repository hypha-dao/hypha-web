'use client';

import React from 'react';
import useSWR from 'swr';
import { TransferWithPerson } from './types';

export const useTransfers = ({
  sort,
  refreshInterval = 10000,
  spaceSlug,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  spaceSlug?: string;
}) => {
  const endpoint = React.useMemo(() => {
    if (!spaceSlug) return '';
    return `/api/v1/spaces/${spaceSlug}/transfers`;
  }, [spaceSlug]);

  const { data, isLoading, error } = useSWR(
    spaceSlug ? [endpoint, sort] : null,
    async ([endpoint, sort]) => {
      const url = new URL(endpoint, window.location.origin);
      if (sort?.sort) {
        url.searchParams.set('sort', sort.sort);
      }

      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch transfers: ${res.statusText}`);
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
