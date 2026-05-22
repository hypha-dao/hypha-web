'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankTransferPublic } from './types';

export function getTransfersEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/transfers`;
}

type UseTransfersOptions = {
  spaceSlug: string;
  enabled?: boolean;
};

type UseTransfersReturn = {
  transfers: BankTransferPublic[];
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<BankTransferPublic[] | undefined>;
};

export const useTransfers = ({
  spaceSlug,
  enabled = true,
}: UseTransfersOptions): UseTransfersReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(
    () => (spaceSlug ? getTransfersEndpoint(spaceSlug) : null),
    [spaceSlug],
  );

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled ? [endpoint, 'transfers'] : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } = useSWR<BankTransferPublic[]>(
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

      return (await res.json()) as BankTransferPublic[];
    },
  );

  const refresh = React.useCallback(() => mutate(), [mutate]);

  return {
    transfers: data ?? [],
    isLoading: isAuthenticated && enabled && isLoading,
    error,
    refresh,
  };
};
