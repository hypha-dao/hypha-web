/**
 * Process-local TTL cache with in-flight coalescing.
 * Used for EnergyPPAv2 snapshots and Azure telemetry so concurrent
 * space-page requests share one expensive read.
 */
export type TtlCache<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  getOrLoad(
    key: string,
    load: () => Promise<T>,
    shouldStore?: (value: T) => boolean,
  ): Promise<T>;
  clear(): void;
};

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const values = new Map<string, { expiresAt: number; value: T }>();
  const pending = new Map<string, Promise<T>>();

  return {
    get(key) {
      const entry = values.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        values.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      values.set(key, { expiresAt: Date.now() + ttlMs, value });
    },
    async getOrLoad(key, load, shouldStore) {
      const cached = this.get(key);
      if (cached !== undefined) return cached;

      const inFlight = pending.get(key);
      if (inFlight) return inFlight;

      const read = load()
        .then((value) => {
          if (!shouldStore || shouldStore(value)) {
            values.set(key, { expiresAt: Date.now() + ttlMs, value });
          }
          return value;
        })
        .finally(() => {
          pending.delete(key);
        });

      pending.set(key, read);
      return read;
    },
    clear() {
      values.clear();
      pending.clear();
    },
  };
}
