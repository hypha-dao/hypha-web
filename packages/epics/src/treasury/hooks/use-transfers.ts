'use client';

import React from 'react';
import useSWR from 'swr';
import { TransferWithEntity } from './types';
import { useAuthentication } from '@hypha-platform/authentication';

export const useTransfers = ({
  sort,
  refreshInterval = 10000,
  spaceSlug,
}: {
  sort?: { sort: string };
  refreshInterval?: number;
  spaceSlug?: string;
}) => {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(() => {
    if (!spaceSlug) return '';
    const base = `/api/v1/spaces/${spaceSlug}/transfers`;
    return sort?.sort ? `${base}?sort=${encodeURIComponent(sort.sort)}` : base;
  }, [spaceSlug, sort]);

  const { data, isLoading, error } = useSWR(
    spaceSlug ? [endpoint] : null,
    async ([endpoint]) => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = {};

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(endpoint, { headers });
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
