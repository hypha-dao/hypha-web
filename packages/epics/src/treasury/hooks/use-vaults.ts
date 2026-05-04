'use client';

import React from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';

export type VaultCollateral = {
  address: string;
  symbol: string;
  name: string;
  icon: string;
  value: number;
  usdEqual: number;
  tokenPrice?: number;
  supply?: {
    total: number;
  };
  space?: {
    title: string;
    slug: string;
  };
  createdAt?: string | Date;
};

export type Vault = {
  spaceToken: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string;
  totalUsd: number;
  backingPercent: number;
  redemptionEnabled?: boolean;
  redemptionPrice?: number;
  redemptionCurrencyFeed?: `0x${string}`;
  minimumBackingPercent?: number;
  maxRedemptionPercent?: number;
  maxRedemptionPeriodDays?: number;
  redemptionStartDate?: string | Date;
  whitelistEnabled?: boolean;
  collaterals: VaultCollateral[];
};

type UseVaultsData = {
  vaults: Vault[];
};

type UseVaultsReturn = {
  vaults: Vault[];
  isLoading: boolean;
  mutate: () => void;
};

export const useVaults = ({
  spaceSlug,
  refreshInterval = 10000,
  redeemableOnly = false,
}: {
  spaceSlug?: string;
  refreshInterval?: number;
  redeemableOnly?: boolean;
} = {}): UseVaultsReturn => {
  const { id } = useParams<{ id: string }>();
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const resolvedSpaceSlug =
    typeof spaceSlug === 'string' ? spaceSlug : id ?? undefined;

  const endpoint = React.useMemo(
    () =>
      resolvedSpaceSlug
        ? `/api/v1/spaces/${resolvedSpaceSlug}/vaults${
            redeemableOnly ? '?redeemableOnly=true' : ''
          }`
        : null,
    [redeemableOnly, resolvedSpaceSlug],
  );

  const { data, isLoading, mutate } = useSWR<UseVaultsData>(
    endpoint && !isAuthLoading ? [endpoint] : null,
    async ([url]) => {
      const token = await getAccessToken();
      if (!token && isAuthenticated) {
        throw new Error('Authentication token not available yet');
      }
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch vaults: ${res.statusText}`);
      }
      const payload = (await res.json()) as UseVaultsData;
      return {
        vaults: (payload.vaults ?? []).map((vault) => ({
          ...vault,
          redemptionStartDate: vault.redemptionStartDate
            ? new Date(vault.redemptionStartDate)
            : undefined,
          collaterals: (vault.collaterals ?? []).map((collateral) => ({
            ...collateral,
            createdAt: collateral.createdAt
              ? new Date(collateral.createdAt)
              : undefined,
          })),
        })),
      };
    },
    {
      refreshInterval,
      shouldRetryOnError: true,
      errorRetryInterval: 1500,
    },
  );

  const vaults = data?.vaults ?? [];

  return {
    vaults,
    isLoading: isAuthLoading || isLoading,
    mutate,
  };
};
