import { describe, expect, it, vi } from 'vitest';
import {
  CHAIN_FACTS_MAX_ENTRIES,
  ChainFactsCache,
} from '../../access/chain-cache';
import { V2_RESPONSE_HEADERS } from '../response-headers';

describe('ChainFactsCache (stale-if-error)', () => {
  const make = () => {
    let t = 0;
    const cache = new ChainFactsCache<number>({
      ttlMs: 30,
      maxStaleMs: 120,
      now: () => t,
    });
    return { cache, advance: (ms: number) => (t += ms) };
  };

  it('serves a fresh entry without reloading', async () => {
    const { cache, advance } = make();
    const load = vi.fn(
      async (keys: string[]) => new Map(keys.map((k) => [k, 1])),
    );
    await cache.getMany(['a'], load);
    advance(29);
    await cache.getMany(['a'], load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL so a healthy chain never serves older data', async () => {
    const { cache, advance } = make();
    let value = 1;
    const load = async (keys: string[]) => new Map(keys.map((k) => [k, value]));
    await cache.getMany(['a'], load);
    value = 2;
    advance(31);
    expect((await cache.getMany(['a'], load)).get('a')).toBe(2);
  });

  it('serves stale only while the reload fails and the entry is within maxStale', async () => {
    const { cache, advance } = make();
    await cache.getMany(['a'], async () => new Map([['a', 1]]));
    const failing = async () => {
      throw new Error('rpc');
    };
    advance(60);
    expect((await cache.getMany(['a'], failing)).get('a')).toBe(1);
    advance(61); // 121ms old: beyond maxStale
    expect((await cache.getMany(['a'], failing)).has('a')).toBe(false);
  });

  it('an older read that finishes last does not overwrite a newer result', async () => {
    const { cache, advance } = make();
    let releaseOld!: () => void;
    const oldLoad = () =>
      new Promise<Map<string, number>>((resolve) => {
        releaseOld = () => resolve(new Map([['a', 1]]));
      });
    const first = cache.getMany(['a'], oldLoad); // starts first, finishes last
    advance(1);
    await cache.getMany(['a'], async () => new Map([['a', 2]])); // starts later, finishes first
    releaseOld();
    await first;
    advance(1);
    const load = vi.fn(async () => new Map<string, number>());
    expect((await cache.getMany(['a'], load)).get('a')).toBe(2);
    expect(load).not.toHaveBeenCalled(); // the newer entry is still fresh
  });

  it('a newer entry older than maxStale no longer beats a value just read', async () => {
    const { cache, advance } = make();
    let releaseOld!: () => void;
    const first = cache.getMany(
      ['a'],
      () =>
        new Promise<Map<string, number>>((resolve) => {
          releaseOld = () => resolve(new Map([['a', 1]]));
        }),
    );
    await cache.getMany(['a'], async () => new Map([['a', 2]])); // newer, stored at t=0
    advance(200); // beyond maxStale (120)
    releaseOld();
    const result = await first;
    expect(result.get('a')).toBe(1); // the value just read, not the over-age newer one
  });

  it('bounds the retained entries: expired ones go first, then the oldest', async () => {
    const { cache, advance } = make();
    const load = async (keys: string[]) => new Map(keys.map((k) => [k, 1]));
    const keys = Array.from(
      { length: CHAIN_FACTS_MAX_ENTRIES + 10 },
      (_, i) => 'k' + i,
    );
    await cache.getMany(keys, load);
    const size = () =>
      (cache as unknown as { entries: Map<string, unknown> }).entries.size;
    expect(size()).toBeLessThanOrEqual(CHAIN_FACTS_MAX_ENTRIES);
    advance(500); // everything is now beyond maxStale
    await cache.getMany(['fresh'], load);
    expect(size()).toBeLessThanOrEqual(CHAIN_FACTS_MAX_ENTRIES);
  });

  it('omits a key the loader could not read (callers fail closed)', async () => {
    const { cache } = make();
    const r = await cache.getMany(['a', 'b'], async () => new Map([['a', 1]]));
    expect([...r.keys()]).toEqual(['a']);
  });
});

describe('v2 response headers', () => {
  it('are private and vary on both credential headers', () => {
    expect(V2_RESPONSE_HEADERS['Cache-Control']).toMatch(/private/);
    expect(V2_RESPONSE_HEADERS.Vary).toContain('Authorization');
    expect(V2_RESPONSE_HEADERS.Vary).toContain('x-hypha-client-key');
  });
});
