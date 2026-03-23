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
  refreshInterval = 10000,
}: { refreshInterval?: number } = {}): UseVaultsReturn => {
  const { id } = useParams<{ id: string }>();
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(
    () => (id ? `/api/v1/spaces/${id}/vaults` : null),
    [id],
  );

  const { data, isLoading, mutate } = useSWR<UseVaultsData>(
    endpoint ? [endpoint] : null,
    async ([url]) => {
      const token = await getAccessToken();
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
    { refreshInterval },
  );

  const vaults = data?.vaults ?? [];

  return {
    vaults,
    isLoading,
    mutate,
  };
};
