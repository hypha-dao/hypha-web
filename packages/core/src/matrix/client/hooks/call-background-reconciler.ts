/**
 * Serial reconciler for the call background effect (#2563): one pass at a time, and every request
 * made while a pass runs gets a pass of its own afterwards (with the latest state). Pure; the pass
 * itself is supplied by `use-space-group-call`.
 */

export type BackgroundReconcileOutcome =
  /** The track matches the latest choice (or nothing to do). */
  | 'done'
  /** A newer request or camera change arrived; the work was dropped. */
  | 'superseded'
  /** The pass could not apply although nothing newer arrived (processor went away); try again. */
  | 'retry';

export type BackgroundReconcilePass = (
  trigger: string,
  isSuperseded: () => boolean,
) => Promise<BackgroundReconcileOutcome>;

export function createBackgroundReconciler(
  pass: BackgroundReconcilePass,
  {
    /** Camera on/off counter; a change supersedes the running pass. */
    epoch = () => 0,
    /** Passes allowed for `retry` outcomes of one request (newer requests are never capped). */
    maxRetries = 3,
  }: { epoch?: () => number; maxRetries?: number } = {},
) {
  let running = false;
  /** Bumps on requests and on invalidate: a running pass compares it to know it is stale. */
  let generation = 0;
  /** Bumps on requests only: decides whether another pass is owed. */
  let requests = 0;
  let latestTrigger = '';

  return {
    /** Asks for a pass; resolves when the reconciler is idle again (or at once if one is running). */
    async request(trigger: string): Promise<void> {
      generation += 1;
      requests += 1;
      latestTrigger = trigger;
      if (running) return;
      running = true;
      let retries = 0;
      try {
        for (;;) {
          const requested = generation;
          const requestCount = requests;
          const startEpoch = epoch();
          let outcome: BackgroundReconcileOutcome;
          try {
            outcome = await pass(
              latestTrigger,
              () => generation !== requested || epoch() !== startEpoch,
            );
          } catch {
            outcome = 'done';
          }
          if (requests !== requestCount) {
            // A newer request arrived meanwhile: it always gets its own pass.
            retries = 0;
            continue;
          }
          if (outcome === 'retry' && (retries += 1) < maxRetries) continue;
          break;
        }
      } finally {
        running = false;
      }
    },
    /** Drops the work of a running pass (call ended) without owing a new pass. */
    invalidate(): void {
      generation += 1;
    },
    get isRunning(): boolean {
      return running;
    },
  };
}
