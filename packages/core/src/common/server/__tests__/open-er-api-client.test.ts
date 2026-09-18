import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getOpenErApiUsdLatest } from '../open-er-api-client';

const originalFetch = globalThis.fetch;

describe('getOpenErApiUsdLatest', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws on a non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    await expect(getOpenErApiUsdLatest()).rejects.toThrow(
      'open.er-api.com latest/USD failed: 503',
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://open.er-api.com/v6/latest/USD',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws when the payload is not success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'error' }),
    }) as unknown as typeof fetch;

    await expect(getOpenErApiUsdLatest()).rejects.toThrow(
      'open.er-api.com latest/USD returned error',
    );
  });
});
