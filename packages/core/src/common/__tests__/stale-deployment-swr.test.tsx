// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import useSWR, { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaleDeployment } from '../stale-deployment';
import { createStaleDeploymentSWRMiddleware } from '../stale-deployment-client';

const missingAction = () =>
  new Error('Server Action "40abc" was not found on the server. \nRead more');

/** Same SWR options the app's SwrProvider sets, on a local instance. */
function setup(onErrorRetry?: () => void) {
  const reload = vi.fn();
  const stale = createStaleDeployment({
    getStorage: () => ({ getItem: () => null, setItem: () => undefined }),
    isWorkInProgress: () => true, // banner path: no reload in jsdom
    reload,
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryCount: 3,
        errorRetryInterval: 10,
        onError: (error) => void stale.handleError(error),
        shouldRetryOnError: stale.shouldRetryOnError,
        use: [createStaleDeploymentSWRMiddleware(stale)],
        // Only when given: replaces SWR's default retry scheduling.
        ...(onErrorRetry ? { onErrorRetry } : {}),
      }}
    >
      {children}
    </SWRConfig>
  );
  return { stale, wrapper };
}

describe('stale deployment with SWR', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('does not retry a missing-action error and marks the tab stale', async () => {
    const onErrorRetry = vi.fn();
    const { stale, wrapper } = setup(onErrorRetry);
    const fetcher = vi.fn().mockRejectedValue(missingAction());
    renderHook(() => useSWR('missing', fetcher), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    // SWR itself decided not to retry (not just the middleware blocking it).
    expect(onErrorRetry).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(stale.isStale()).toBe(true);
    expect(stale.getStatus()).toBe('banner');
  });

  it('still retries other errors and does not mark the tab stale', async () => {
    const { stale, wrapper } = setup();
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    renderHook(() => useSWR('other', fetcher), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
    expect(stale.isStale()).toBe(false);
  });

  it('stops polling hooks from sending requests once the tab is stale', async () => {
    const { stale, wrapper } = setup();
    const polled = vi.fn().mockResolvedValue('ok');
    renderHook(() => useSWR('polled', polled, { refreshInterval: 1_000 }), {
      wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    const callsBefore = polled.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(1);

    act(() => void stale.handleError(missingAction()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(polled.mock.calls.length).toBe(callsBefore);
  });
});
