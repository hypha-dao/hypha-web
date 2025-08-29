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
    return `/api/v1/spaces/${spaceSlug}/transfers`;
  }, [spaceSlug]);

  const { data, isLoading, error } = useSWR(
    spaceSlug && jwt ? [endpoint, sort, jwt] : null,
    async ([endpoint, sort, jwt]) => {
      const url = new URL(endpoint, window.location.origin);
      if (sort?.sort) {
        url.searchParams.set('sort', sort.sort);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch transfers: ${res.statusText}`);
      }
      return await res.json();
    },
    { refreshInterval },
  );

  return {
    transfers: data as TransferWithEntity[],
    isLoading,
    error,
  };
};
