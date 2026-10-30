// @vitest-environment jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/en/dho/space-a/energy' }));
const auth = vi.hoisted(() => ({
  getAccessToken: (): Promise<string | null> => Promise.resolve('token'),
}));

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: auth.getAccessToken,
    isLoading: false,
  }),
}));

import {
  EnergyTelemetryTimeoutError,
  useSpaceEnergyTelemetry,
} from '../use-space-energy-telemetry';

const payload = (period: string) => ({
  enabled: true,
  configured: true,
  period,
  labels: ['1/10'],
  consumptionKwh: [1],
  consumptionByMeter: [],
  productionBySource: [],
  gridImportKwh: [0],
  gridExportKwh: [0],
  totals: {
    producedKwh: 0,
    consumedKwh: 1,
    netKwh: -1,
    gridImportedKwh: 0,
    gridExportedKwh: 0,
  },
  dataFrom: '2026-10-01T00:00:00.000Z',
  dataTo: '2026-10-29T00:00:00.000Z',
  communityId: 1,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      revalidateOnFocus: false,
    }}
  >
    {children}
  </SWRConfig>
);

type PendingFetch = {
  url: string;
  signal: AbortSignal;
  resolve: (body: unknown) => void;
};

let pending: PendingFetch[] = [];

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('useSpaceEnergyTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pending = [];
    auth.getAccessToken = () => Promise.resolve('token');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string, init: RequestInit) =>
          new Promise((resolve, reject) => {
            const signal = init.signal as AbortSignal;
            signal.addEventListener('abort', () => reject(signal.reason));
            pending.push({
              url,
              signal,
              resolve: (body) =>
                resolve(new Response(JSON.stringify(body), { status: 200 })),
            });
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('leaves loading after the soft timeout, then shows the late result', async () => {
    nav.pathname = '/en/dho/slow-space/energy';
    const { result } = renderHook(() => useSpaceEnergyTelemetry('30d'), {
      wrapper,
    });
    await advance(0);
    expect(pending).toHaveLength(1);
    expect(result.current.isLoading).toBe(true);

    await advance(24_000);
    expect(result.current.isLoading).toBe(true);
    await advance(1_000);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(EnergyTelemetryTimeoutError);

    await act(async () => {
      pending[0]!.resolve(payload('30d'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.data?.period).toBe('30d');
  });

  it('sends the request without a token when Privy stalls', async () => {
    nav.pathname = '/en/dho/stalled-auth/energy';
    auth.getAccessToken = () => new Promise<string | null>(() => undefined);
    renderHook(() => useSpaceEnergyTelemetry('7d'), { wrapper });

    await advance(4_000);
    expect(pending).toHaveLength(0);
    await advance(1_000);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.url).toContain('/stalled-auth/energy/telemetry');
  });

  it('aborts the request when the period changes or the hook unmounts', async () => {
    nav.pathname = '/en/dho/switch-space/energy';
    const { rerender, unmount } = renderHook(
      ({ period }: { period: '7d' | '30d' }) => useSpaceEnergyTelemetry(period),
      { wrapper, initialProps: { period: '30d' } },
    );
    await advance(0);
    const first = pending[0]!;

    rerender({ period: '7d' });
    await advance(0);
    expect(first.signal.aborted).toBe(true);
    const second = pending[1]!;
    expect(second.url).toContain('period=7d');
    expect(second.signal.aborted).toBe(false);

    unmount();
    await advance(0);
    expect(second.signal.aborted).toBe(true);
  });

  it('does not request while disabled', async () => {
    nav.pathname = '/en/dho/disabled-space/energy';
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSpaceEnergyTelemetry('7d', { enabled, refreshInterval: 0 }),
      { wrapper, initialProps: { enabled: false } },
    );
    await advance(0);
    expect(pending).toHaveLength(0);

    rerender({ enabled: true });
    await advance(0);
    expect(pending).toHaveLength(1);
  });

  it('keeps a shared request alive while another subscriber is mounted', async () => {
    nav.pathname = '/en/dho/shared-space/energy';
    const first = renderHook(() => useSpaceEnergyTelemetry('30d'), {
      wrapper,
    });
    renderHook(() => useSpaceEnergyTelemetry('30d'), { wrapper });
    await advance(0);
    expect(pending).toHaveLength(1);
    const request = pending[0]!;

    first.unmount();
    await advance(0);
    expect(request.signal.aborted).toBe(false);
  });
});
