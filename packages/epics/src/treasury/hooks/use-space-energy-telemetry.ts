'use client';

import React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { usePathname } from 'next/navigation';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import type { Timeframe } from '../components/assets/energy/dummy-data';

/** Server-side telemetry period. Superset of the chart `Timeframe` toggle values. */
export type TelemetryPeriod = Timeframe | '12w';

/**
 * Periods used across Energy sub-tabs (flows timeframe + ownership/overview
 * granularities). Prefetch these when the Energy section mounts.
 */
export const ENERGY_TELEMETRY_PREFETCH_PERIODS: readonly TelemetryPeriod[] = [
  '7d',
  '30d',
  '90d',
  '12w',
  '12m',
];

export type EnergyTelemetrySourceSeries = {
  meterId: number;
  label: string;
  valuesKwh: number[];
};

export type EnergyTelemetryMeterSeries = {
  meterId: number;
  valuesKwh: number[];
};

export type SpaceEnergyTelemetryResponse = {
  enabled: boolean;
  configured: boolean;
  period: TelemetryPeriod;
  labels: string[];
  consumptionKwh: number[];
  /** Consumption broken down by meter id; join with member deviceIds for per-user views. */
  consumptionByMeter: EnergyTelemetryMeterSeries[];
  productionBySource: EnergyTelemetrySourceSeries[];
  gridImportKwh: number[];
  gridExportKwh: number[];
  totals: {
    producedKwh: number;
    consumedKwh: number;
    netKwh: number;
    gridImportedKwh: number;
    gridExportedKwh: number;
  };
  dataFrom: string | null;
  dataTo: string | null;
  communityId: number | null;
};

export type EnergyTelemetrySWRKey = readonly [string, TelemetryPeriod];

export const energyTelemetryKey = (
  spaceSlug: string,
  period: TelemetryPeriod,
): EnergyTelemetrySWRKey =>
  [
    `/api/v1/spaces/${encodeURIComponent(
      spaceSlug,
    )}/energy/telemetry?period=${encodeURIComponent(period)}`,
    period,
  ] as const;

export async function fetchSpaceEnergyTelemetry(
  path: string,
  getAccessToken: () => Promise<string | null | undefined>,
): Promise<SpaceEnergyTelemetryResponse> {
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
}

/**
 * Warm the SWR cache for every telemetry period used by Energy sub-tabs so
 * Production & consumption / Ownership do not flash loading states on first open.
 */
export const usePrefetchSpaceEnergyTelemetry = (enabled: boolean) => {
  const pathname = usePathname();
  const spaceSlug = React.useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { getAccessToken, isLoading: isAuthLoading } = useAuthentication();
  const { mutate } = useSWRConfig();

  React.useEffect(() => {
    if (!enabled || isAuthLoading || !spaceSlug) return;

    let cancelled = false;

    const run = async () => {
      await Promise.all(
        ENERGY_TELEMETRY_PREFETCH_PERIODS.map(async (period) => {
          if (cancelled) return;
          const key = energyTelemetryKey(spaceSlug, period);
          try {
            await mutate(
              key,
              () => fetchSpaceEnergyTelemetry(key[0], getAccessToken),
              { revalidate: false },
            );
          } catch {
            // Individual period failures should not block others; tabs will
            // retry via their own useSWR hooks when opened.
          }
        }),
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, isAuthLoading, spaceSlug, getAccessToken, mutate]);
};

export const useSpaceEnergyTelemetry = (period: TelemetryPeriod) => {
  const pathname = usePathname();
  const spaceSlug = React.useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { getAccessToken, isLoading: isAuthLoading } = useAuthentication();

  const swrKey = React.useMemo(() => {
    if (isAuthLoading || !spaceSlug) return null;
    return energyTelemetryKey(spaceSlug, period);
  }, [isAuthLoading, period, spaceSlug]);

  const { data, isLoading, error, mutate } = useSWR(
    swrKey,
    ([path]) => fetchSpaceEnergyTelemetry(path, getAccessToken),
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
