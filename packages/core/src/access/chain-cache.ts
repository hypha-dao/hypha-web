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

/** `gen` orders loads per key: a load that STARTED later wins, whatever finishes last. */
type Entry<V> = { value: V; at: number; gen: number };

/** Upper bound of retained keys (a cold instance starts empty; one entry per wallet or space). */
export const CHAIN_FACTS_MAX_ENTRIES = 5_000;

export class ChainFactsCache<V> {
  private entries = new Map<string, Entry<V>>();
  private generation = 0;

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

    // Order loads by when they started, per key (see `Entry.gen`).
    const gen = ++this.generation;
    let loaded: Map<string, V> | null = null;
    try {
      loaded = await loadMissing(stale);
    } catch (error) {
      console.error('[api-v2] chain facts reload failed', error);
    }

    for (const key of stale) {
      const fresh = loaded?.get(key);
      if (fresh !== undefined) {
        const current = this.entries.get(key);
        if (
          current &&
          current.gen > gen &&
          this.now() - current.at < this.opts.maxStaleMs
        ) {
          // A load that started after this one already stored its result: keep the newer one
          // (while it is within the stale limit; otherwise the value just read is stored).
          result.set(key, current.value);
          continue;
        }
        this.entries.set(key, { value: fresh, at: this.now(), gen });
        result.set(key, fresh);
        continue;
      }
      const old = this.entries.get(key);
      if (old && this.now() - old.at < this.opts.maxStaleMs) {
        result.set(key, old.value);
      }
    }
    this.evict();
    return result;
  }

  /** Drops entries too old to serve even as stale, then the oldest ones past the cap. */
  private evict() {
    if (this.entries.size <= CHAIN_FACTS_MAX_ENTRIES) return;
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.at >= this.opts.maxStaleMs) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= CHAIN_FACTS_MAX_ENTRIES) break;
      this.entries.delete(key); // Map keeps insertion order: the oldest written first
    }
  }
}
