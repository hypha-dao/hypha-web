'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { DEFAULT_BANK_PROVIDER } from '@hypha-platform/core/client';

import type { BankCustomerPublicStatus } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

export function getBankCustomerStatusEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/bank-customers`;
}

type UseBankCustomerStatusOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
};

type UseBankCustomerStatusReturn = {
  /**
   * The Bridge entry from `providers`, exactly the shape every existing money-movement consumer
   * (rails, transfers, payouts, `hasApprovedBankCurrencies`, …) already expects — money movement
   * is a Bridge-only capability today (D5), so this stays the right thing to gate that UI on.
   */
  status: BankCustomerPublicStatus | null;
  /** Every provider's status for this owner (D11) — one entry per `bank_customers` row (D3). */
  providers: BankCustomerPublicStatus[];
  /** True when the GET returned a non-404 error (customer row exists but fetch failed). */
  isError: boolean;
  /** True only on the first status fetch (not background revalidation). */
  isLoading: boolean;
  isRefreshing: boolean;
  /** Re-fetches and returns the Bridge entry, same contract as before D11. */
  refresh: () => Promise<BankCustomerPublicStatus | null | undefined>;
  /** Re-fetches and returns every provider's status — for flows that need the full list fresh. */
  refreshProviders: () => Promise<BankCustomerPublicStatus[] | undefined>;
};

function findBridgeStatus(
  providers: BankCustomerPublicStatus[],
): BankCustomerPublicStatus | null {
  return (
    providers.find((entry) => entry.provider === DEFAULT_BANK_PROVIDER) ??
    null
  );
}

async function fetchBankCustomerStatuses(
  url: string,
  getAccessToken: () => Promise<string | null>,
): Promise<BankCustomerPublicStatus[]> {
  const token = await getAccessToken();
  if (!token) {
    return [];
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`bank-customers GET failed with status ${res.status}`);
  }

  const body = (await res.json()) as BankCustomerPublicStatus[] | null;
  if (body == null) {
    return [];
  }

  return body.filter((entry) => entry.hasCustomer !== false);
}

export const useBankCustomerStatus = ({
  spaceSlug,
  basePath,
}: UseBankCustomerStatusOptions): UseBankCustomerStatusReturn => {
  const { getAccessToken, isAuthenticated } = useAuthentication();

  const endpoint = React.useMemo(() => {
    const base = resolveBankingBasePath({ spaceSlug, basePath });
    return base ? `${base}/bank-customers` : null;
  }, [spaceSlug, basePath]);

  const swrKey = React.useMemo(
    () =>
      endpoint && isAuthenticated ? [endpoint, 'bank-customer-status'] : null,
    [endpoint, isAuthenticated],
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    BankCustomerPublicStatus[]
  >(
    swrKey,
    ([url]: [string, string]) =>
      fetchBankCustomerStatuses(url, getAccessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  const providers = data ?? [];

  const refreshProviders = React.useCallback(async () => {
    try {
      return await mutate();
    } catch {
      return undefined;
    }
  }, [mutate]);

  const refresh = React.useCallback(async () => {
    const updated = await refreshProviders();
    return updated ? findBridgeStatus(updated) : undefined;
  }, [refreshProviders]);

  return {
    status: findBridgeStatus(providers),
    providers,
    isError: error != null,
    isLoading: isAuthenticated && isLoading,
    isRefreshing: isAuthenticated && isValidating && !isLoading,
    refresh,
    refreshProviders,
  };
};
