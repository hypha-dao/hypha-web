/**
 * Handling for tabs that run an older build than the server.
 *
 * After a deploy, an open tab still calls Server Action ids the new build no
 * longer has; Next answers with a 404 and `x-nextjs-action-not-found`, which
 * the client turns into a "Server Action ... was not found on the server"
 * error. Retrying or polling cannot succeed, so the tab reloads once (guarded
 * so it cannot loop) or, when the user has work in progress, asks them to
 * refresh. Pure logic only: browser wiring is injected so it can be tested.
 */

/** sessionStorage key holding the time of the last automatic reload. */
export const STALE_RELOAD_STORAGE_KEY = 'hypha:stale-action-reload:v1';
/** At most one automatic reload per window. */
export const STALE_RELOAD_WINDOW_MS = 5 * 60_000;
/** How long the "reloading" notice shows before the reload. */
export const STALE_RELOAD_DELAY_MS = 3_000;

const MISSING_ACTION_ERROR_CODE = 'E715';
// Plain string checks, not a regex: the message is not under our control and a
// backtracking pattern on it can run in quadratic time.
const MISSING_ACTION_PREFIX = 'Server Action "';
const MISSING_ACTION_SUFFIX = '" was not found on the server';

/**
 * True only for Next.js's "Server Action not found" error. Never matches a
 * plain 404 or any other failure. The response header is not reachable from
 * client code, so this checks the error Next throws for it.
 */
export function isActionNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { __NEXT_ERROR_CODE: code, message } = error as {
    __NEXT_ERROR_CODE?: unknown;
    message?: unknown;
  };
  if (code === MISSING_ACTION_ERROR_CODE) return true;
  return (
    typeof message === 'string' &&
    message.startsWith(MISSING_ACTION_PREFIX) &&
    message.includes(MISSING_ACTION_SUFFIX)
  );
}

/** idle: nothing to show. reloading: short notice. banner: user must refresh. */
export type StaleDeploymentStatus = 'idle' | 'reloading' | 'banner';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type StaleDeploymentOptions = {
  getStorage: () => StorageLike;
  isWorkInProgress: () => boolean;
  reload: () => void;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
  windowMs?: number;
  delayMs?: number;
};

export function createStaleDeployment({
  getStorage,
  isWorkInProgress,
  reload,
  now = Date.now,
  schedule = (fn, ms) => void setTimeout(fn, ms),
  windowMs = STALE_RELOAD_WINDOW_MS,
  delayMs = STALE_RELOAD_DELAY_MS,
}: StaleDeploymentOptions) {
  let status: StaleDeploymentStatus = 'idle';
  let stale = false;
  let staleError: unknown = null;
  const listeners = new Set<() => void>();

  const setStatus = (next: StaleDeploymentStatus) => {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  };

  /** Read-only: is an automatic reload allowed in this window? Trouble: no. */
  const canReload = (): boolean => {
    try {
      const raw = getStorage().getItem(STALE_RELOAD_STORAGE_KEY);
      if (raw === null) return true;
      const last = Number(raw);
      return Number.isFinite(last) && now() - last >= windowMs;
    } catch {
      return false;
    }
  };

  /**
   * Records the reload, right before it happens, and checks it stuck so a
   * failed write cannot turn into a reload loop. Any storage trouble: no.
   */
  const claimReload = (): boolean => {
    if (!canReload()) return false;
    try {
      const storage = getStorage();
      const stamp = String(now());
      storage.setItem(STALE_RELOAD_STORAGE_KEY, stamp);
      return storage.getItem(STALE_RELOAD_STORAGE_KEY) === stamp;
    } catch {
      return false;
    }
  };

  const decide = () => {
    if (isWorkInProgress() || !canReload()) {
      setStatus('banner');
      return;
    }
    setStatus('reloading');
    schedule(() => {
      if (isWorkInProgress() || !claimReload()) {
        setStatus('banner');
        return;
      }
      reload();
    }, delayMs);
  };

  return {
    /** Returns true if the error was the missing-action error. */
    handleError(error: unknown): boolean {
      if (!isActionNotFoundError(error)) return false;
      if (!stale) {
        stale = true;
        staleError = error;
      }
      // A burst of failing calls reports many errors; decide only once.
      if (status === 'idle') decide();
      return true;
    },
    /** True once any missing-action error was seen in this tab. */
    isStale: () => stale,
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** For SWR's `shouldRetryOnError`: never retry the missing-action error. */
    shouldRetryOnError: (error: unknown) => !isActionNotFoundError(error),
    /**
     * Wraps a fetcher so that, once the tab is stale, it rejects with the same
     * error without sending a request (stops polling and focus refreshes).
     */
    wrapFetcher<Args extends unknown[], Result>(
      fetcher: (...args: Args) => Result,
    ): (...args: Args) => Result | Promise<never> {
      return (...args) =>
        stale ? Promise.reject(staleError) : fetcher(...args);
    },
  };
}

/**
 * Tracks whether the user may have work in progress that a reload would lose.
 * Detection is deliberately broad: it errs towards showing the banner.
 */
export function createWorkInProgressTracker() {
  let typed = false;
  const probes = new Set<() => boolean>();
  return {
    /** The user typed into or changed a field since the page loaded. */
    markUserInput() {
      typed = true;
    },
    /** Registers a check (for example "a call is active"); returns remover. */
    addProbe(probe: () => boolean) {
      probes.add(probe);
      return () => void probes.delete(probe);
    },
    isActive(): boolean {
      if (typed) return true;
      for (const probe of probes) {
        try {
          if (probe()) return true;
        } catch {
          return true;
        }
      }
      return false;
    },
  };
}
