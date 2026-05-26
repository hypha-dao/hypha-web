'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankAddAccountRailOption } from './types';
import { getVirtualAccountsEndpoint } from './use-virtual-accounts';

type UseAddAccountRailsOptions = {
  spaceSlug: string;
  enabled?: boolean;
};

export function useAddAccountRails({
  spaceSlug,
  enabled = true,
}: UseAddAccountRailsOptions) {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      spaceSlug
        ? `${getVirtualAccountsEndpoint(spaceSlug)}?mode=add-options`
        : null,
    [spaceSlug],
  );

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated && enabled
        ? [endpoint, 'add-account-rails']
        : null,
    [endpoint, isAuthenticated, enabled],
  );

  const { data, error, isLoading, mutate } = useSWR<{ options: BankAddAccountRailOption[] }>(
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
        throw new Error('Failed to fetch add-account options');
      }

      return (await res.json()) as { options: BankAddAccountRailOption[] };
    },
  );

  return {
    options: data?.options ?? [],
    isLoading: isAuthenticated && enabled && isLoading,
    error,
    refresh: mutate,
  };
}
