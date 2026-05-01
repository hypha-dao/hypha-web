'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';

export type UserEnergyCommunity = {
  spaceId: number;
  chainId: number;
  communityProxyAddress: `0x${string}`;
  energyTokenAddress: `0x${string}`;
  activatedAt: string;
  energyCreditBalance: string;
  debtInStablecoin: string;
  creditInStablecoin: string;
  sourceOwnerships: Array<{
    sourceId: `0x${string}`;
    ownershipBps: string;
  }>;
};

export type UserEnergyResponse = {
  enabled: boolean;
  communities: UserEnergyCommunity[];
  totals?: {
    energyCreditBalance: string;
    debtInStablecoin: string;
    creditInStablecoin: string;
  };
};

export const useUserEnergy = (personSlug?: string) => {
  const { jwt } = useJwt();
  const endpoint = React.useMemo(
    () => (personSlug ? `/api/v1/people/${personSlug}/energy` : null),
    [personSlug],
  );

  const { data, isLoading, error, mutate } = useSWR(
    jwt && endpoint ? [endpoint, jwt] : null,
    async ([path, token]) => {
      const response = await fetch(path, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch user energy data: ${response.status}`);
      }
      return (await response.json()) as UserEnergyResponse;
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
