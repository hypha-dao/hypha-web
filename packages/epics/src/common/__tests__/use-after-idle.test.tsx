// @vitest-environment jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAfterIdle, useEnergyOverviewIdleGate } from '../use-after-idle';

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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits on the energy route so other tabs do not prefetch yet', () => {
    const { result } = renderHook(() => useEnergyOverviewIdleGate());
    expect(result.current).toBe(false);
  });
});
