import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getCoingeckoBitcoinUsdTzsQuotes } from '../coingecko-client';

const originalFetch = globalThis.fetch;

describe('getCoingeckoBitcoinUsdTzsQuotes', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws on a non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    await expect(getCoingeckoBitcoinUsdTzsQuotes()).rejects.toThrow(
      'CoinGecko simple/price failed: 503',
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,tzs',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
