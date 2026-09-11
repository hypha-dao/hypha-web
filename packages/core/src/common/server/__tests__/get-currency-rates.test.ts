import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { cacheInstances } = vi.hoisted(() => ({
  cacheInstances: [] as Array<{
    store: Map<string, unknown>;
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => boolean;
  }>,
}));

vi.mock('node-cache', () => ({
  default: class {
    store = new Map<string, unknown>();
    constructor() {
      cacheInstances.push(this);
    }
    get(key: string) {
      return this.store.get(key);
    }
    set(key: string, value: unknown) {
      this.store.set(key, value);
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
const TZS_RATE = 100_000 / 265_000_000;

function mockSuccessFetch() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ bitcoin: { usd: 100_000, tzs: 265_000_000 } }),
  }) as unknown as typeof fetch;
}

function mockFailedFetch() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
  }) as unknown as typeof fetch;
}

function ratesCache() {
  return cacheInstances[0];
}

function lastOffchainCache() {
  return cacheInstances[1];
}

describe('getUsdRates', () => {
  beforeEach(() => {
    multicall.mockReset();
    multicall.mockResolvedValue([]);
    for (const instance of cacheInstances) {
      instance.store.clear();
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('merges an off-chain TZS/USD rate instead of treating TZS as 1:1', async () => {
    mockSuccessFetch();

    const rates = await getUsdRates();

    expect(rates.USD).toBe(1);
    expect(rates.TZS).toBeCloseTo(TZS_RATE, 12);
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
    mockFailedFetch();

    const rates = await getUsdRates();

    expect(rates.TZS).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it('does not renew a last-known TZS quote after failed refreshes', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSuccessFetch();
    await getUsdRates();

    const lastCache = lastOffchainCache();
    const stored = lastCache.get('last_offchain_usd_rates') as
      | { TZS?: number }
      | undefined;
    expect(stored?.TZS).toBeCloseTo(TZS_RATE, 12);

    const setSpy = vi.spyOn(lastCache, 'set');
    // Simulate the 5-minute rates cache expiring while the 24h fallback remains.
    ratesCache().store.clear();
    mockFailedFetch();

    const fallbackRates = await getUsdRates();
    expect(fallbackRates.TZS).toBeCloseTo(TZS_RATE, 12);
    expect(setSpy).not.toHaveBeenCalled();

    // Another miss after the fallback TTL would have elapsed: no live quote
    // and no renewed last-known entry.
    ratesCache().store.clear();
    lastCache.store.clear();
    const afterTtl = await getUsdRates();
    expect(afterTtl.TZS).toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
