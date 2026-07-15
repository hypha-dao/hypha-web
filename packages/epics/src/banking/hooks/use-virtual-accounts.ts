'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { PaginatedBankVirtualAccounts } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

export function getVirtualAccountsEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/accounts`;
}

type UseVirtualAccountsOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
  enabled?: boolean;
};

type UseVirtualAccountsReturn = {
  accounts: PaginatedBankVirtualAccounts['accounts'];
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<PaginatedBankVirtualAccounts | undefined>;
};

export const useVirtualAccounts = ({
  spaceSlug,
  basePath,
  enabled = true,
}: UseVirtualAccountsOptions): UseVirtualAccountsReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(() => {
    const base = resolveBankingBasePath({ spaceSlug, basePath });
    return base ? `${base}/accounts` : null;
  }, [spaceSlug, basePath]);

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled
        ? [endpoint, 'virtual-accounts']
        : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } =
    useSWR<PaginatedBankVirtualAccounts>(
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
          throw new Error('Failed to fetch bank accounts');
        }

        return (await res.json()) as PaginatedBankVirtualAccounts;
      },
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      },
    );

  const refresh = React.useCallback(() => mutate(), [mutate]);

  return {
    accounts: data?.accounts ?? [],
    hasMore: data?.hasMore ?? false,
    nextCursor: data?.nextCursor ?? null,
    isLoading: isAuthenticated && enabled && isLoading,
    error,
    refresh,
  };
};
