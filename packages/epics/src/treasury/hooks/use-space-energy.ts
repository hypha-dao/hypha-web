'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';

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
    communityFeeBps: number;
    aggregatorFeeBps: number;
    gridBalance: string;
    settledBalance: string;
    contractStablecoinBalance: string;
    zeroSumOk: boolean;
    zeroSumDelta: string;
  };
  sources?: SpaceEnergySource[];
};

export const useSpaceEnergy = () => {
  const { id } = useParams<{ id: string }>();
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(() => `/api/v1/spaces/${id}/energy`, [id]);

  const { data, isLoading, mutate, error } = useSWR(
    [endpoint],
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
