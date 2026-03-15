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
};

export type Vault = {
  spaceToken: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string;
  totalUsd: number;
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
    [endpoint],
    async ([url]) => {
      if (!url) return { vaults: [] };
      const token = await getAccessToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch vaults: ${res.statusText}`);
      }
      return res.json();
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
