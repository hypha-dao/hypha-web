'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankTransferRailOption } from './types';
import { getTransfersEndpoint } from './use-transfers';

type UseTransferRailOptionsArgs = {
  spaceSlug: string;
  enabled?: boolean;
};

export function useTransferRailOptions({
  spaceSlug,
  enabled = true,
}: UseTransferRailOptionsArgs) {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      spaceSlug
        ? `${getTransfersEndpoint(spaceSlug)}?mode=transfer-options`
        : null,
    [spaceSlug],
  );

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
