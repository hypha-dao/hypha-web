export const MAX_BOUND_LOOKUP_IDS = 100;
/** Failed lookups are retried after 5 min, doubling each time up to the cap. */
export const BOUND_LOOKUP_RETRY_BASE_MS = 5 * 60_000;
export const BOUND_LOOKUP_RETRY_MAX_MS = 30 * 60_000;
/** After this many failed tries a room is left alone until `reset()`. */
export const BOUND_LOOKUP_MAX_ATTEMPTS = 3;

type Failure = { attempts: number; retryAt: number };

type BoundRoomLookupOptions = {
  lookup: (roomIds: string[], authToken: string) => Promise<string[]>;
  /** Called with the bound room ids of each successful chunk. */
  onBound: (boundIds: string[]) => void;
  onError?: (error: unknown) => void;
  now?: () => number;
};

/**
 * Looks up which Matrix rooms are bound to a space or signal. A room is asked
 * about once; a failed lookup is remembered (backoff, small retry cap) so a
 * rejecting action is not called again on every `/sync` response. Rooms stay
 * treated as unbound while they are in backoff.
 */
export function createBoundRoomLookup({
  lookup,
  onBound,
  onError,
  now = Date.now,
}: BoundRoomLookupOptions) {
  const checked = new Set<string>();
  const failures = new Map<string, Failure>();
  let inFlight = false;

  const isPending = (id: string, at: number) => {
    if (checked.has(id)) return false;
    const failure = failures.get(id);
    if (!failure) return true;
    return (
      failure.attempts < BOUND_LOOKUP_MAX_ATTEMPTS && at >= failure.retryAt
    );
  };

  const markFailed = (ids: string[]) => {
    const at = now();
    for (const id of ids) {
      const attempts = (failures.get(id)?.attempts ?? 0) + 1;
      const delay = Math.min(
        BOUND_LOOKUP_RETRY_BASE_MS * 2 ** (attempts - 1),
        BOUND_LOOKUP_RETRY_MAX_MS,
      );
      failures.set(id, { attempts, retryAt: at + delay });
    }
  };

  /** Resolves when the lookup finishes; no-op without work to do. */
  async function refresh(roomIds: readonly string[], authToken: string) {
    if (inFlight) return;
    const at = now();
    const pending = roomIds.filter((id) => isPending(id, at));
    if (pending.length === 0) return;
    inFlight = true;
    try {
      for (let i = 0; i < pending.length; i += MAX_BOUND_LOOKUP_IDS) {
        const chunk = pending.slice(i, i + MAX_BOUND_LOOKUP_IDS);
        let bound: string[];
        try {
          bound = await lookup(chunk, authToken);
        } catch (error) {
          // The rest of this batch would hit the same failure: back it off too.
          markFailed(pending.slice(i));
          onError?.(error);
          return;
        }
        for (const id of chunk) {
          checked.add(id);
          failures.delete(id);
        }
        try {
          onBound(bound);
        } catch (error) {
          onError?.(error);
        }
      }
    } finally {
      inFlight = false;
    }
  }

  function reset() {
    checked.clear();
    failures.clear();
  }

  return { refresh, reset };
}
