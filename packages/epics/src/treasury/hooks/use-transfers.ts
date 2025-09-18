'use client';

import React from 'react';
import useSWR from 'swr';
import { TransferWithEntity } from './types';
import { useJwt } from '@hypha-platform/core/client';

export const useTransfers = ({
  sort,
  refreshInterval = 10000,
  spaceSlug,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  spaceSlug?: string;
}) => {
  const { jwt } = useJwt();

  const endpoint = React.useMemo(() => {
    if (!spaceSlug) return '';
    const base = `/api/v1/spaces/${spaceSlug}/transfers`;
    return sort?.sort ? `${base}?sort=${encodeURIComponent(sort.sort)}` : base;
  }, [spaceSlug, sort]);

  const { data, isLoading, error } = useSWR(
    spaceSlug && jwt ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      try {
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch transfers: ${res.statusText}`);
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
