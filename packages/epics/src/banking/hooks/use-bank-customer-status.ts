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
  /** True when the GET returned a non-404 error (customer row exists but fetch failed). */
  isError: boolean;
  /** True only on the first status fetch (not background revalidation). */
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<BankCustomerPublicStatus | null | undefined>;
};

async function fetchBankCustomerStatus(
  url: string,
  getAccessToken: () => Promise<string | null>,
): Promise<BankCustomerPublicStatus | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`bank-customers GET failed with status ${res.status}`);
  }

  const body = (await res.json()) as BankCustomerPublicStatus | null;
  if (body == null) {
    return null;
  }

  return body.hasCustomer === false ? null : body;
}

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

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BankCustomerPublicStatus | null>(
      swrKey,
      ([url]: [string, string]) => fetchBankCustomerStatus(url, getAccessToken),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
      },
    );

  const refresh = React.useCallback(async () => {
    try {
      return await mutate();
    } catch {
      return undefined;
    }
  }, [mutate]);

  return {
    status: data ?? null,
    isError: error != null,
    isLoading: isAuthenticated && isLoading,
    isRefreshing: isAuthenticated && isValidating && !isLoading,
    refresh,
  };
};
