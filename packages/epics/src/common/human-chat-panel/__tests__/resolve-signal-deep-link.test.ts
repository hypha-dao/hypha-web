// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSignalDeepLinkWithRetry } from '../resolve-signal-deep-link';

describe('resolveSignalDeepLinkWithRetry (CSH-DISCOVER-2/3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries until auth token is available', async () => {
    let token: string | null = null;
    const fetchSignal = vi.fn(
      async (_signalId: string, authToken: string | null) => {
        if (!authToken) {
          return new Response(null, { status: 401 });
        }
        return Response.json({
          signalSlug: 'budget-q2',
          signalTitle: 'Budget Q2',
          spaceSlug: 'demo-space',
          roomId: '!room:matrix.org',
        });
      },
    );

    const promise = resolveSignalDeepLinkWithRetry({
      signalId: 'sig-1',
      expectedSpaceSlug: 'demo-space',
      getAuthToken: () => token,
      fetchSignal,
    });

    await vi.advanceTimersByTimeAsync(500);
    token = 'ready-token';
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toEqual({
      ok: true,
      signalSlug: 'budget-q2',
      signalTitle: 'Budget Q2',
      spaceSlug: 'demo-space',
      roomId: '!room:matrix.org',
    });
  });

  it('returns auth_not_ready after retries exhaust', async () => {
    const resultPromise = resolveSignalDeepLinkWithRetry({
      signalId: 'sig-1',
      expectedSpaceSlug: 'demo-space',
      getAuthToken: () => null,
      fetchSignal: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(7000);
    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: 'auth_not_ready',
    });
  });

  it('returns not_found for 404 responses', async () => {
    const result = await resolveSignalDeepLinkWithRetry({
      signalId: 'missing',
      expectedSpaceSlug: 'demo-space',
      getAuthToken: () => 'token',
      fetchSignal: vi.fn(async () => new Response(null, { status: 404 })),
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});
