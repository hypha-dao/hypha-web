'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { PaginatedBankTransfers } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

export function getTransfersEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/transfers`;
}

type UseTransfersOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
  enabled?: boolean;
};

type UseTransfersReturn = {
  transfers: PaginatedBankTransfers['transfers'];
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<PaginatedBankTransfers | undefined>;
};

export const useTransfers = ({
  spaceSlug,
  basePath,
  enabled = true,
}: UseTransfersOptions): UseTransfersReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(() => {
    const base = resolveBankingBasePath({ spaceSlug, basePath });
    return base ? `${base}/transfers` : null;
  }, [spaceSlug, basePath]);

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled ? [endpoint, 'transfers'] : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } = useSWR<PaginatedBankTransfers>(
    swrKey,
    async ([url]: [string, string]) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Unauthorized');
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch transfers');
      }

      return (await res.json()) as PaginatedBankTransfers;
    },
  );

  const refresh = React.useCallback(() => mutate(), [mutate]);

  return {
    transfers: data?.transfers ?? [],
    hasMore: data?.hasMore ?? false,
    nextCursor: data?.nextCursor ?? null,
    isLoading: isAuthenticated && enabled && isLoading,
    error,
    refresh,
  };
};
