import 'server-only';

import { after } from 'next/server';
import { getCache } from '@vercel/functions';

type Entry<T> = { value: T; storedAt: number };

const sharedCache = getCache({ namespace: 'hypha-swr' });
const localEntries = new Map<string, Entry<unknown>>();
const refreshing = new Map<string, Promise<unknown>>();

function isEntry(value: unknown): value is Entry<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    'value' in value &&
    typeof (value as { storedAt?: unknown }).storedAt === 'number'
  );
}

async function readShared(key: string): Promise<Entry<unknown> | undefined> {
  try {
    const value = await sharedCache.get(key);
    return isEntry(value) ? value : undefined;
  } catch (error) {
    console.warn(`[swr-cache] read ${key} failed`, error);
    return undefined;
  }
}

type ReadOptions<T> = {
  key: string;
  /** Entries older than this are served once more and refreshed after the response. */
  freshMs: number;
  /** How long the shared runtime cache keeps an entry at all. */
  ttlSeconds: number;
  load: () => Promise<T>;
  /** Partial results are returned but never stored. */
  shouldStore?: (value: T) => boolean;
};

function refresh<T>({
  key,
  ttlSeconds,
  load,
  shouldStore,
}: ReadOptions<T>): Promise<T> {
  const inFlight = refreshing.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const run = (async () => {
    const value = await load();
    if (!shouldStore || shouldStore(value)) {
      const entry: Entry<T> = { value, storedAt: Date.now() };
      localEntries.set(key, entry);
      await sharedCache
        .set(key, entry, { ttl: ttlSeconds })
        .catch((error: unknown) => {
          console.warn(`[swr-cache] write ${key} failed`, error);
        });
    }
    return value;
  })().finally(() => {
    refreshing.delete(key);
  });
  refreshing.set(key, run);
  return run;
}

/**
 * Stale-while-revalidate over the Vercel Runtime Cache (in-memory off Vercel).
 * Only a cold miss waits for `load`; stale hits refresh in `after()`, so the
 * response is never held open by the refresh.
 */
export async function readStaleWhileRevalidate<T>(
  options: ReadOptions<T>,
): Promise<T> {
  const { key, freshMs } = options;
  const isFresh = (entry: Entry<unknown>) =>
    Date.now() - entry.storedAt < freshMs;

  let entry = localEntries.get(key);
  if (!entry || !isFresh(entry)) {
    const shared = await readShared(key);
    if (shared && (!entry || shared.storedAt > entry.storedAt)) {
      entry = shared;
      localEntries.set(key, shared);
    }
  }

  if (!entry) {
    return structuredClone(await refresh(options));
  }

  if (!isFresh(entry)) {
    after(() =>
      refresh(options).catch((error: unknown) => {
        console.warn(`[swr-cache] refresh ${key} failed`, error);
      }),
    );
  }
  return structuredClone(entry.value as T);
}
