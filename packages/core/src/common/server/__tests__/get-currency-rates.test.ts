import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('node-cache', () => ({
  default: class {
    get() {
      return undefined;
    }
    set() {
      return true;
    }
  },
}));

const { multicall } = vi.hoisted(() => ({
  multicall: vi.fn(),
}));

vi.mock('../web3-rpc/client', () => ({
  web3Client: {
    multicall,
  },
}));

import { getUsdRates } from '../get-currency-rates';

const originalFetch = globalThis.fetch;

describe('getUsdRates', () => {
  beforeEach(() => {
    multicall.mockReset();
    multicall.mockResolvedValue([]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('merges an off-chain TZS/USD rate instead of treating TZS as 1:1', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 100_000, tzs: 265_000_000 } }),
    }) as unknown as typeof fetch;

    const rates = await getUsdRates();

    expect(rates.USD).toBe(1);
    expect(rates.TZS).toBeCloseTo(100_000 / 265_000_000, 12);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,tzs',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('omits TZS when the off-chain source fails and no prior rate exists', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }) as unknown as typeof fetch;

    const rates = await getUsdRates();

    expect(rates.TZS).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
