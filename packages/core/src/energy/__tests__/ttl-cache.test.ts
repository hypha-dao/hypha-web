import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTtlCache } from '../server/ttl-cache';

describe('createTtlCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached values until they expire', () => {
    vi.useFakeTimers();
    const cache = createTtlCache<string>(1_000);
    cache.set('ponta', 'ready');
    expect(cache.get('ponta')).toBe('ready');
    vi.advanceTimersByTime(999);
    expect(cache.get('ponta')).toBe('ready');
    vi.advanceTimersByTime(2);
    expect(cache.get('ponta')).toBeUndefined();
  });

  it('coalesces concurrent loads and skips storing failed sentinels', async () => {
    const cache = createTtlCache<string | null>(5_000);
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve('ok');
    };

    const [first, second] = await Promise.all([
      cache.getOrLoad('1132', load),
      cache.getOrLoad('1132', load),
    ]);

    expect(first).toBe('ok');
    expect(second).toBe('ok');
    expect(loads).toBe(1);

    await cache.getOrLoad(
      'miss',
      async () => null,
      (value) => value !== null,
    );
    expect(cache.get('miss')).toBeUndefined();
  });
});
