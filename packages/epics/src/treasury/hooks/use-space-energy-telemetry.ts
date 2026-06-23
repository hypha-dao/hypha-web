'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { usePathname } from 'next/navigation';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import type { Timeframe } from '../components/assets/energy/dummy-data';

export type EnergyTelemetrySourceSeries = {
  meterId: number;
  label: string;
  valuesKwh: number[];
};

export type SpaceEnergyTelemetryResponse = {
  enabled: boolean;
  configured: boolean;
  period: Timeframe;
  labels: string[];
  consumptionKwh: number[];
  productionBySource: EnergyTelemetrySourceSeries[];
  totals: {
    producedKwh: number;
    consumedKwh: number;
    netKwh: number;
  };
  dataFrom: string | null;
  dataTo: string | null;
  communityId: number | null;
};

export const useSpaceEnergyTelemetry = (period: Timeframe) => {
  const pathname = usePathname();
  const spaceSlug = React.useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { getAccessToken, isLoading: isAuthLoading } = useAuthentication();

  const endpoint = React.useMemo(() => {
    if (isAuthLoading || !spaceSlug) return null;
    return `/api/v1/spaces/${spaceSlug}/energy/telemetry?period=${period}`;
  }, [isAuthLoading, period, spaceSlug]);

  const { data, isLoading, error, mutate } = useSWR(
    endpoint ? [endpoint, period] : null,
    async ([path]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(path, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch energy telemetry: ${response.status}`);
      }
      return (await response.json()) as SpaceEnergyTelemetryResponse;
    },
    {
      refreshInterval: 60_000,
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
