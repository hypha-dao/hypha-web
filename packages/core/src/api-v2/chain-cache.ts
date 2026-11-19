/**
 * Short-lived cache of CHAIN FACTS for `/api/v2` (levels, a viewer's spaces,
 * space members/executors). Never used for per-viewer responses.
 *
 * Policy: stale-if-error, not stale-while-revalidate. A fresh entry (younger
 * than `ttlMs`) is served as is; an older one is reloaded before use, so a
 * healthy chain never serves data older than `ttlMs`. If the reload FAILS, the
 * stale entry is served only while younger than `maxStaleMs`; beyond that the
 * key is absent and callers fail closed (hide/deny). So the window in which a
 * space made more private can still be listed is `ttlMs` normally and at most
 * `maxStaleMs` while the chain is unreadable.
 *
 * In-memory and per server instance (no shared store): every cold instance
 * starts empty.
 */
export const CHAIN_FACTS_TTL_MS = 30_000;
export const CHAIN_FACTS_MAX_STALE_MS = 120_000;

type Entry<V> = { value: V; at: number };

export class ChainFactsCache<V> {
  private entries = new Map<string, Entry<V>>();

  constructor(
    private readonly opts: {
      ttlMs: number;
      maxStaleMs: number;
      now?: () => number;
    } = { ttlMs: CHAIN_FACTS_TTL_MS, maxStaleMs: CHAIN_FACTS_MAX_STALE_MS },
  ) {}

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  clear() {
    this.entries.clear();
  }

  /**
   * `loadMissing` receives every key that is absent or older than the TTL and
   * returns what it could read (omit a key it could not). Keys that end up
   * with no usable value are absent from the result.
   */
  async getMany(
    keys: readonly string[],
    loadMissing: (keys: string[]) => Promise<Map<string, V>>,
  ): Promise<Map<string, V>> {
    const now = this.now();
    const result = new Map<string, V>();
    const stale: string[] = [];

    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry && now - entry.at < this.opts.ttlMs) {
        result.set(key, entry.value);
      } else {
        stale.push(key);
      }
    }
    if (stale.length === 0) return result;

    let loaded: Map<string, V> | null = null;
    try {
      loaded = await loadMissing(stale);
    } catch (error) {
      console.error('[api-v2] chain facts reload failed', error);
    }

    for (const key of stale) {
      const fresh = loaded?.get(key);
      if (fresh !== undefined) {
        this.entries.set(key, { value: fresh, at: this.now() });
        result.set(key, fresh);
        continue;
      }
      const old = this.entries.get(key);
      if (old && this.now() - old.at < this.opts.maxStaleMs) {
        result.set(key, old.value);
      }
    }
    return result;
  }
}
