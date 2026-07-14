'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { PaginatedBankPayoutAccounts } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

export function getPayoutAccountsEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/payout-accounts`;
}

type UsePayoutAccountsOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
  enabled?: boolean;
};

type UsePayoutAccountsReturn = {
  accounts: PaginatedBankPayoutAccounts['accounts'];
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<PaginatedBankPayoutAccounts | undefined>;
};

export const usePayoutAccounts = ({
  spaceSlug,
  basePath,
  enabled = true,
}: UsePayoutAccountsOptions): UsePayoutAccountsReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(() => {
    const base = resolveBankingBasePath({ spaceSlug, basePath });
    return base ? `${base}/payout-accounts` : null;
  }, [spaceSlug, basePath]);

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled
        ? [endpoint, 'payout-accounts']
        : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } =
    useSWR<PaginatedBankPayoutAccounts>(
      swrKey,
      async ([url]: [string, string]) => {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch payout accounts');
        }

        return (await res.json()) as PaginatedBankPayoutAccounts;
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
