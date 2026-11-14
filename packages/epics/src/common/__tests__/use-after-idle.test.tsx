// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { holdEnergySevenDaySettled } from '../energy-seven-day-settled';
import {
  shouldFetchEnergyGatedIntelligence,
  toLinkPrefetch,
  useAfterIdle,
  useEnergyGatedSWRKey,
  useEnergyOverviewIdleGate,
} from '../use-after-idle';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dho/ponta-do-sol-energy-community/energy',
}));

describe('useAfterIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(0), 0) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });
    vi.stubGlobal('requestIdleCallback', undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is true immediately when not waiting', () => {
    const { result } = renderHook(() => useAfterIdle(false));
    expect(result.current).toBe(true);
  });

  it('stays false until after the first paint', () => {
    const { result } = renderHook(() => useAfterIdle(true));
    expect(result.current).toBe(false);
  });

  it('becomes true after the paint timeout when idle callback is missing', async () => {
    const { result } = renderHook(() => useAfterIdle(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current).toBe(true);
  });

  it('returns false on the first render after wait flips from false to true', () => {
    const { result, rerender } = renderHook(
      ({ wait }: { wait: boolean }) => useAfterIdle(wait),
      { initialProps: { wait: false } },
    );
    expect(result.current).toBe(true);
    rerender({ wait: true });
    expect(result.current).toBe(false);
  });
});

describe('shouldFetchEnergyGatedIntelligence', () => {
  it('blocks a hidden sheet and the energy route until 7d is ready', () => {
    expect(shouldFetchEnergyGatedIntelligence(false, { enabled: true })).toBe(
      false,
    );
    expect(shouldFetchEnergyGatedIntelligence(true, { enabled: false })).toBe(
      false,
    );
    expect(
      shouldFetchEnergyGatedIntelligence(true, {
        enabled: true,
        hasProvidedData: true,
      }),
    ).toBe(false);
    expect(shouldFetchEnergyGatedIntelligence(true, { enabled: true })).toBe(
      true,
    );
  });
});

describe('toLinkPrefetch', () => {
  it('uses viewport auto prefetch when ready and disables it while waiting', () => {
    expect(toLinkPrefetch(true)).toBeNull();
    expect(toLinkPrefetch(false)).toBe(false);
  });
});

describe('useEnergyOverviewIdleGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(0), 0) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });
    vi.stubGlobal('requestIdleCallback', undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits on the energy route until 7d telemetry has settled', () => {
    const { result } = renderHook(() => useEnergyOverviewIdleGate());
    expect(result.current).toBe(false);
    let release: () => void = () => undefined;
    act(() => {
      release = holdEnergySevenDaySettled();
    });
    expect(result.current).toBe(true);
    act(() => {
      release();
    });
    expect(result.current).toBe(false);
  });
});

describe('useEnergyGatedSWRKey', () => {
  it('drops the intelligence key on energy until 7d has settled', () => {
    const key = ['/api/v1/people/me/intelligence', 'jwt'] as const;
    const { result } = renderHook(() => useEnergyGatedSWRKey(key));
    expect(result.current).toBeNull();
    let release: () => void = () => undefined;
    act(() => {
      release = holdEnergySevenDaySettled();
    });
    expect(result.current).toEqual(key);
    act(() => {
      release();
    });
    expect(result.current).toBeNull();
  });
});
