'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankTransferRailOption } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

type UseTransferRailOptionsArgs = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
  enabled?: boolean;
};

export function useTransferRailOptions({
  spaceSlug,
  basePath,
  enabled = true,
}: UseTransferRailOptionsArgs) {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(() => {
    const base = resolveBankingBasePath({ spaceSlug, basePath });
    return base ? `${base}/transfers?mode=transfer-options` : null;
  }, [spaceSlug, basePath]);

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled
        ? [endpoint, 'transfer-rail-options']
        : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } = useSWR<{
    options: BankTransferRailOption[];
  }>(swrKey, async ([url]: [string, string]) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Unauthorized');
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch transfer options');
    }

    return (await res.json()) as { options: BankTransferRailOption[] };
  });

  return {
    options: data?.options ?? [],
    isLoading: isAuthenticated && enabled && isLoading,
    error,
    refresh: mutate,
  };
}
