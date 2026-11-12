// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProposalVoters } from '../useProposalVoters';

const wrapperWith =
  (config: React.ComponentProps<typeof SWRConfig>['value'] = {}) =>
  ({ children }: { children: React.ReactNode }) =>
    (
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, ...config }}
      >
        {children}
      </SWRConfig>
    );

const ok = (voters: unknown[]) => Response.json({ voters });
const fail = (status: number) =>
  new Response(JSON.stringify({ error: 'x' }), { status });

describe('useProposalVoters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns voters on 200 and keeps polling every 15 s', async () => {
    const fn = vi.fn().mockImplementation(async () => ok([{ id: 1 }]));
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith(),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.voters).toEqual([{ id: 1 }]);
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exposes the status on a 404 and stops polling', async () => {
    const fn = vi.fn().mockImplementation(async () => fail(404));
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith({ shouldRetryOnError: false }),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect((result.current.error as { status?: number }).status).toBe(404);
    expect(result.current.voters).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps stale voters after a failed poll, then recovers and resumes polling', async () => {
    const responses = [
      () => ok([{ id: 1 }]),
      () => fail(500),
      () => ok([{ id: 2 }]),
    ];
    const fn = vi
      .fn()
      .mockImplementation(async () =>
        (responses.shift() ?? (() => ok([{ id: 2 }])))(),
      );
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith({ errorRetryInterval: 1000 }),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.voters).toEqual([{ id: 1 }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000); // poll -> 500
    });
    expect((result.current.error as { status?: number }).status).toBe(500);
    expect(result.current.voters).toEqual([{ id: 1 }]); // stale data kept

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // error retry -> 200
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.voters).toEqual([{ id: 2 }]);

    const calls = fn.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(fn.mock.calls.length).toBeGreaterThan(calls); // polling resumed
  });
});
