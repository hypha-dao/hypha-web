import 'server-only';

import { after } from 'next/server';
import { getCache } from '@vercel/functions';

type Entry<T> = { value: T; storedAt: number };

const sharedCache = getCache({ namespace: 'hypha-swr' });
const localEntries = new Map<string, Entry<unknown>>();
const refreshing = new Map<string, Promise<unknown>>();

const LOADING_SUFFIX = ':loading';
const LOADING_POLL_MS = 1_000;

export class StaleWhileRevalidateBusyError extends Error {
  constructor(key: string) {
    super(`Cache entry ${key} is still loading on another instance`);
    this.name = 'StaleWhileRevalidateBusyError';
  }
}

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
    console.warn('[swr-cache] read %s failed', key, error);
    return undefined;
  }
}

async function isLoadingElsewhere(key: string): Promise<boolean> {
  try {
    return Boolean(await sharedCache.get(key + LOADING_SUFFIX));
  } catch {
    return false;
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
  /**
   * Coalesce cold misses across instances in a region: a load advertises
   * itself for `lockSeconds` (its worst-case duration), and other cold misses
   * wait up to `waitMs` for its result instead of starting the same load.
   */
  coalesce?: { waitMs: number; lockSeconds: number };
};

function refresh<T>({
  key,
  ttlSeconds,
  load,
  shouldStore,
  coalesce,
}: ReadOptions<T>): Promise<T> {
  const inFlight = refreshing.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const loadingKey = key + LOADING_SUFFIX;
  const run = (async () => {
    if (coalesce) {
      await sharedCache
        .set(
          loadingKey,
          { startedAt: Date.now() },
          { ttl: coalesce.lockSeconds },
        )
        .catch(() => undefined);
    }
    const value = await load();
    if (!shouldStore || shouldStore(value)) {
      const entry: Entry<T> = { value, storedAt: Date.now() };
      localEntries.set(key, entry);
      await sharedCache
        .set(key, entry, { ttl: ttlSeconds })
        .catch((error: unknown) => {
          console.warn('[swr-cache] write %s failed', key, error);
        });
    }
    return value;
  })().finally(() => {
    refreshing.delete(key);
    if (coalesce) {
      void sharedCache.delete(loadingKey).catch(() => undefined);
    }
  });
  refreshing.set(key, run);
  return run;
}

/**
 * Waits while another instance is loading `key` and resolves with its stored
 * entry; `undefined` means nothing was loading. Throws
 * `StaleWhileRevalidateBusyError` when that load is still running after
 * `waitMs` or ended without storing, so callers retry later instead of all
 * starting the same load at once.
 */
async function waitForLoadElsewhere(
  key: string,
  waitMs: number,
): Promise<Entry<unknown> | undefined> {
  if (!(await isLoadingElsewhere(key))) return undefined;
  const deadline = Date.now() + waitMs;
  do {
    const entry = await readShared(key);
    if (entry) return entry;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, LOADING_POLL_MS));
  } while (await isLoadingElsewhere(key));
  const entry = await readShared(key);
  if (entry) return entry;
  throw new StaleWhileRevalidateBusyError(key);
}

/**
 * Stale-while-revalidate over the Vercel Runtime Cache (in-memory off Vercel).
 * Only a cold miss waits for `load`; stale hits refresh in `after()`, so the
 * response is never held open by the refresh.
 */
export async function readStaleWhileRevalidate<T>(
  options: ReadOptions<T>,
): Promise<T> {
  const { key, freshMs, coalesce } = options;
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

  if (!entry && coalesce && !refreshing.has(key)) {
    entry = await waitForLoadElsewhere(key, coalesce.waitMs);
    if (entry) localEntries.set(key, entry);
  }

  if (!entry) {
    return structuredClone(await refresh(options));
  }

  if (!isFresh(entry)) {
    after(() =>
      refresh(options).catch((error: unknown) => {
        console.warn('[swr-cache] refresh %s failed', key, error);
      }),
    );
  }
  return structuredClone(entry.value as T);
}
