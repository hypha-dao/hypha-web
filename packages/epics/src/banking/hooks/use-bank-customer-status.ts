'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankCustomerPublicStatus } from './types';

export function getBankCustomerStatusEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/bank-customers`;
}

type UseBankCustomerStatusOptions = {
  spaceSlug: string;
};

type UseBankCustomerStatusReturn = {
  status: BankCustomerPublicStatus | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<BankCustomerPublicStatus | null | undefined>;
};

export const useBankCustomerStatus = ({
  spaceSlug,
}: UseBankCustomerStatusOptions): UseBankCustomerStatusReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(
    () => (spaceSlug ? getBankCustomerStatusEndpoint(spaceSlug) : null),
    [spaceSlug],
  );

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated ? [endpoint, 'bank-customer-status'] : null,
    [endpoint, isAuthenticated],
  );

  const { data, error, isLoading, mutate } =
    useSWR<BankCustomerPublicStatus | null>(
      swrKey,
      async ([url]) => {
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
          throw new Error('Failed to fetch bank customer status');
        }

        return (await res.json()) as BankCustomerPublicStatus | null;
      },
    );

  const refresh = React.useCallback(() => mutate(), [mutate]);

  return {
    status: data ?? null,
    isLoading: isAuthenticated && isLoading,
    error,
    refresh,
  };
};
