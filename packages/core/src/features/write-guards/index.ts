import { createHash } from 'node:crypto';

/**
 * Guards shared by the write features that AI clients reach (#2744): a rate limit per person and
 * the duplicate rule for retries. Signals are the first user; quests and the vote reuse them.
 */

/** Take one write for `key`; `retryAfterSeconds` is set when a limit is hit. */
export type WriteRateLimiter = {
  take(key: string): { ok: true } | { ok: false; retryAfterSeconds: number };
};

export type RateWindow = { limit: number; windowMs: number };

/**
 * Signal creation: at most 10 a minute and 100 an hour per person, across all of the person's AI
 * clients (two connected apps share one budget). Generous for a person, quick to stop a loop.
 */
export const SIGNAL_CREATE_LIMITS: readonly RateWindow[] = [
  { limit: 10, windowMs: 60_000 },
  { limit: 100, windowMs: 3_600_000 },
];

/** The key of one person's signal-creation budget. Ids only, never a name. */
export const signalCreateRateKey = (personId: number) =>
  `signals.create:${personId}`;

/**
 * A limiter held in memory with fixed windows; every window must allow the write, and a refused
 * write spends nothing. It is per server instance, so it is a safety net against a runaway client,
 * not an exact quota; a shared store can replace it behind `WriteRateLimiter`.
 */
export function createMemoryWriteRateLimiter(
  windows: readonly RateWindow[],
  now: () => number = Date.now,
): WriteRateLimiter {
  const counters = windows.map(
    () => new Map<string, { start: number; count: number }>(),
  );
  const MAX_KEYS = 5000;
  return {
    take(key) {
      const t = now();
      let retryAfterMs = 0;
      const current = windows.map((w, i) => {
        const map = counters[i]!;
        let entry = map.get(key);
        if (!entry || t - entry.start >= w.windowMs) {
          entry = { start: t, count: 0 };
        }
        if (entry.count >= w.limit) {
          retryAfterMs = Math.max(retryAfterMs, entry.start + w.windowMs - t);
        }
        return entry;
      });
      if (retryAfterMs > 0) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }
      current.forEach((entry, i) => {
        const map = counters[i]!;
        entry.count += 1;
        map.set(key, entry);
        if (map.size > MAX_KEYS) {
          for (const [k, v] of map) {
            if (t - v.start >= windows[i]!.windowMs) map.delete(k);
          }
        }
      });
      return { ok: true };
    },
  };
}

/** A repeated create with the same content inside this window returns the first one. */
export const DUPLICATE_WINDOW_MS = 10 * 60_000;

/** Text compared for duplicates: Unicode-normalised, trimmed, whitespace collapsed, lower case. */
export function normaliseForDuplicate(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Fingerprint of one write's content for one person, space and client. Used only as the lock
 * key that serialises identical writes; it is not stored.
 */
export function contentFingerprint(parts: {
  personId: number;
  spaceId: number;
  clientId: string;
  title: string;
  description: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        parts.personId,
        parts.spaceId,
        parts.clientId,
        normaliseForDuplicate(parts.title),
        normaliseForDuplicate(parts.description),
      ]),
    )
    .digest('hex');
}
