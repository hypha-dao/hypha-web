// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProposalVoters } from '../useProposalVoters';
import { BATCH_WINDOW_MS } from '../batch-proposal-voters';
import { POLL } from '../../../../common/poll-intervals';

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

const ok = (voters: unknown[], slug = 'doc') =>
  Response.json({ voters: { [slug]: voters }, failed: [] });
const fail = (status: number) =>
  new Response(JSON.stringify({ error: 'x' }), { status });

/** The batch window, then the fetch and its state updates. */
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
  });

describe('useProposalVoters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns voters on 200 and keeps polling on the active tier', async () => {
    const fn = vi.fn().mockImplementation(async () => ok([{ id: 1 }]));
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith(),
    });
    await settle();
    expect(result.current.voters).toEqual([{ id: 1 }]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(String(fn.mock.calls[0]?.[0])).toBe(
      '/api/v1/documents/voters?slugs=doc',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL.ACTIVE);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cards mounted together share one request', async () => {
    const fn = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({
          voters: { a: [{ id: 1 }], b: [{ id: 2 }] },
          failed: [],
        }),
      );
    vi.stubGlobal('fetch', fn);
    const a = renderHook(() => useProposalVoters('a'), {
      wrapper: wrapperWith(),
    });
    const b = renderHook(() => useProposalVoters('b'), {
      wrapper: wrapperWith(),
    });
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a.result.current.voters).toEqual([{ id: 1 }]);
    expect(b.result.current.voters).toEqual([{ id: 2 }]);
  });

  it('mutate() refetches this proposal at once (own vote shows without waiting for the poll)', async () => {
    const responses = [() => ok([]), () => ok([{ id: 1, vote: 'yes' }])];
    const fn = vi
      .fn()
      .mockImplementation(async () => (responses.shift() ?? responses[0]!)());
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith(),
    });
    await settle();
    expect(result.current.voters).toEqual([]);

    await act(async () => {
      void result.current.mutate();
    });
    await settle();
    expect(result.current.voters).toEqual([{ id: 1, vote: 'yes' }]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exposes the status on a 404 and stops polling', async () => {
    const fn = vi.fn().mockImplementation(async () => fail(404));
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposalVoters('doc'), {
      wrapper: wrapperWith({ shouldRetryOnError: false }),
    });
    await settle();
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
    await settle();
    expect(result.current.voters).toEqual([{ id: 1 }]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL.ACTIVE + BATCH_WINDOW_MS); // poll -> 500
    });
    expect((result.current.error as { status?: number }).status).toBe(500);
    expect(result.current.voters).toEqual([{ id: 1 }]); // stale data kept

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000 + BATCH_WINDOW_MS); // error retry -> 200
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.voters).toEqual([{ id: 2 }]);

    const calls = fn.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL.ACTIVE + BATCH_WINDOW_MS);
    });
    expect(fn.mock.calls.length).toBeGreaterThan(calls); // polling resumed
  });
});
