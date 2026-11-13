// @vitest-environment jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOverviewFirstTelemetryPrefetch } from '../use-overview-first-telemetry-prefetch';

describe('useOverviewFirstTelemetryPrefetch', () => {
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

  it('does not prefetch telemetry while overview is painting', () => {
    const { result } = renderHook(() =>
      useOverviewFirstTelemetryPrefetch(true, 'overview'),
    );
    expect(result.current).toBe(false);
  });

  it('starts prefetch after the first paint when requestIdleCallback is missing', async () => {
    const { result } = renderHook(() =>
      useOverviewFirstTelemetryPrefetch(true, 'overview'),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current).toBe(true);
  });

  it('starts prefetch immediately when leaving overview', () => {
    const { result } = renderHook(() =>
      useOverviewFirstTelemetryPrefetch(true, 'flows'),
    );
    expect(result.current).toBe(true);
  });

  it('stays off when energy data has not arrived', async () => {
    const { result } = renderHook(() =>
      useOverviewFirstTelemetryPrefetch(false, 'overview'),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current).toBe(false);
  });
});
