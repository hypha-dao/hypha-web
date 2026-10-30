'use client';

import React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { usePathname } from 'next/navigation';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import type { Timeframe } from '../components/assets/energy/dummy-data';

/** Server-side telemetry period. Superset of the chart `Timeframe` toggle values. */
export type TelemetryPeriod = Timeframe | '12w';

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

/**
 * Uncached Azure reads take ~22s (7d) and ~31s (30d). Past this the UI stops
 * waiting and shows the error state; the request keeps running and a late
 * result still replaces the error.
 */
const TELEMETRY_SOFT_TIMEOUT_MS = 25_000;
/** Below the route's 90s `maxDuration`, so a hung request is always released. */
const TELEMETRY_HARD_TIMEOUT_MS = 60_000;
const TELEMETRY_TOKEN_WAIT_MS = 5_000;

export class EnergyTelemetryTimeoutError extends Error {
  constructor() {
    super('Energy telemetry request timed out');
    this.name = 'EnergyTelemetryTimeoutError';
  }
}

class EnergyTelemetryCancelledError extends Error {
  constructor() {
    super('Energy telemetry request cancelled');
    this.name = 'EnergyTelemetryCancelledError';
  }
}

type InflightTelemetry = {
  controller: AbortController;
  promise: Promise<SpaceEnergyTelemetryResponse>;
};

// SWR shares one request per key across components, so cancellation is
// tracked per endpoint and only fires once the last subscriber leaves.
const inflightTelemetry = new Map<string, InflightTelemetry>();
const telemetrySubscribers = new Map<string, number>();

function rejectOnAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function startTelemetryRequest(
  path: string,
  getAccessToken: () => Promise<string | null>,
): InflightTelemetry {
  const controller = new AbortController();
  const hardTimer = setTimeout(
    () => controller.abort(new EnergyTelemetryTimeoutError()),
    TELEMETRY_HARD_TIMEOUT_MS,
  );
  const promise = (async () => {
    try {
      // A stalled Privy refresh must not keep the request from being sent;
      // public spaces load without a token, restricted ones fail with 401.
      const token = await rejectOnAbort(
        Promise.race([
          getAccessToken().catch(() => null),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), TELEMETRY_TOKEN_WAIT_MS),
          ),
        ]),
        controller.signal,
      );
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(path, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch energy telemetry: ${response.status}`);
      }
      return (await response.json()) as SpaceEnergyTelemetryResponse;
    } catch (error) {
      // Older browsers reject with a generic AbortError instead of the reason.
      throw controller.signal.aborted ? controller.signal.reason : error;
    }
  })().finally(() => {
    clearTimeout(hardTimer);
    if (inflightTelemetry.get(path)?.controller === controller) {
      inflightTelemetry.delete(path);
    }
  });
  const entry = { controller, promise };
  inflightTelemetry.set(path, entry);
  return entry;
}

export const useSpaceEnergyTelemetry = (period: TelemetryPeriod) => {
  const pathname = usePathname();
  const spaceSlug = React.useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { getAccessToken, isLoading: isAuthLoading } = useAuthentication();
  const { mutate: mutateCache } = useSWRConfig();

  const endpoint = React.useMemo(() => {
    if (isAuthLoading || !spaceSlug) return null;
    return `/api/v1/spaces/${encodeURIComponent(
      spaceSlug,
    )}/energy/telemetry?period=${encodeURIComponent(period)}`;
  }, [isAuthLoading, period, spaceSlug]);

  React.useEffect(() => {
    if (!endpoint) return;
    telemetrySubscribers.set(
      endpoint,
      (telemetrySubscribers.get(endpoint) ?? 0) + 1,
    );
    return () => {
      const left = (telemetrySubscribers.get(endpoint) ?? 1) - 1;
      if (left > 0) {
        telemetrySubscribers.set(endpoint, left);
        return;
      }
      telemetrySubscribers.delete(endpoint);
      // Deferred so a StrictMode remount or quick tab switch can re-subscribe.
      setTimeout(() => {
        if (telemetrySubscribers.has(endpoint)) return;
        inflightTelemetry
          .get(endpoint)
          ?.controller.abort(new EnergyTelemetryCancelledError());
      }, 0);
    };
  }, [endpoint]);

  const { data, isLoading, isValidating, error, mutate } = useSWR(
    endpoint ? ([endpoint, period] as const) : null,
    async (key: readonly [string, TelemetryPeriod]) => {
      const [path] = key;
      const request =
        inflightTelemetry.get(path) ??
        startTelemetryRequest(path, getAccessToken);
      let softTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          request.promise,
          new Promise<never>((_, reject) => {
            softTimer = setTimeout(
              () => reject(new EnergyTelemetryTimeoutError()),
              TELEMETRY_SOFT_TIMEOUT_MS,
            );
          }),
        ]);
      } catch (fetchError) {
        if (
          fetchError instanceof EnergyTelemetryTimeoutError &&
          !request.controller.signal.aborted
        ) {
          void request.promise.then(
            (late) => mutateCache(key, late, { revalidate: false }),
            () => undefined,
          );
        }
        throw fetchError;
      } finally {
        clearTimeout(softTimer);
      }
    },
    {
      refreshInterval: 60_000,
      shouldRetryOnError: false,
    },
  );

  // A cancelled request had no subscribers left and is refetched on remount,
  // so it reads as loading rather than as a failure.
  const cancelled = error instanceof EnergyTelemetryCancelledError;
  const visibleError = cancelled ? undefined : error;

  React.useEffect(() => {
    if (cancelled && endpoint) void mutate();
  }, [cancelled, endpoint, mutate]);

  return {
    data,
    isLoading:
      !visibleError &&
      data === undefined &&
      (isLoading || isValidating || cancelled),
    error: visibleError,
    refresh: mutate,
  };
};
