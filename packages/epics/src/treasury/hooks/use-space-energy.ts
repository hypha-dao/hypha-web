'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { usePathname } from 'next/navigation';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';

export type SpaceEnergySource = {
  sourceId: `0x${string}`;
  sourceLabel: string;
  sourceType: string;
  ownershipToken: `0x${string}`;
  basePricePerKwh: string;
  active: boolean;
};

export type SpaceEnergyResponse = {
  enabled: boolean;
  activation?: {
    spaceId: number;
    chainId: number;
    communityProxyAddress: `0x${string}`;
    energyTokenAddress: `0x${string}`;
    adminAddress: `0x${string}`;
    factoryCommunityId?: number | null;
    activatedAt: string;
  };
  overview?: {
    memberCount: number;
    sourceCount: number;
    // Per-field reads can fail (RPC throttling, individual revert from a
    // misconfigured proxy). The API exposes `null` so the UI can render a
    // partial overview instead of erroring out.
    communityFeeBps: number | null;
    aggregatorFeeBps: number | null;
    gridBalance: string | null;
    settledBalance: string | null;
    contractStablecoinBalance: string | null;
    zeroSumOk: boolean | null;
    zeroSumDelta: string | null;
  };
  sources?: SpaceEnergySource[];
  roles?: {
    communityAddress: `0x${string}` | null;
    aggregatorAddress: `0x${string}` | null;
    gridOperator: `0x${string}` | null;
    exportDeviceId: string | null;
  };
  members?: `0x${string}`[];
  optimization?: {
    configured: boolean;
    purposeRanking: string[];
    socialMode: string;
    socialFixedKwh: string;
    socialVariableBps: number;
    socialWallets: { wallet: `0x${string}`; shareBps: number }[];
  } | null;
};

export const useSpaceEnergy = () => {
  const pathname = usePathname();
  const spaceSlug = React.useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { getAccessToken, isLoading: isAuthLoading } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      !isAuthLoading && spaceSlug ? `/api/v1/spaces/${spaceSlug}/energy` : null,
    [isAuthLoading, spaceSlug],
  );

  const { data, isLoading, mutate, error } = useSWR(
    endpoint ? [endpoint] : null,
    async ([path]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(path, { headers });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch space energy data: ${response.status}`,
        );
      }
      return (await response.json()) as SpaceEnergyResponse;
    },
    {
      refreshInterval: 15000,
      shouldRetryOnError: false,
    },
  );

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
  };
};
