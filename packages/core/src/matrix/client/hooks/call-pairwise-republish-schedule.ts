import { republishLocalMediaToPairwiseCalls } from './call-pairwise-restart';

/** Avoid SDP renegotiation races while ICE is still connecting. */
const REPUBLISH_DEBOUNCE_MS = 2_000;
const REPUBLISH_MIN_INTERVAL_MS = 4_000;

let republishDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let republishPendingGc: unknown = null;
let republishPendingForce = false;
let republishPendingDelayMs = REPUBLISH_DEBOUNCE_MS;
let lastRepublishCompletedAt = 0;

export function resetPairwiseRepublishScheduleForTests(): void {
  if (republishDebounceTimer != null) {
    clearTimeout(republishDebounceTimer);
    republishDebounceTimer = null;
  }
  republishPendingGc = null;
  republishPendingForce = false;
  republishPendingDelayMs = REPUBLISH_DEBOUNCE_MS;
  lastRepublishCompletedAt = 0;
}

export function clearPairwiseRepublishSchedule(): void {
  resetPairwiseRepublishScheduleForTests();
}

/**
 * Debounced pairwise republish — `updateLocalUsermediaStream` on active
 * `MatrixCall` sessions triggers SDP renegotiation; batching avoids
 * `setRemoteDescription` races during initial ICE connect.
 */
export function scheduleRepublishLocalMediaToPairwiseCalls(
  gc: unknown,
  options?: { force?: boolean; delayMs?: number },
): void {
  if (typeof setTimeout === 'undefined') return;
  republishPendingGc = gc;
  if (options?.force) republishPendingForce = true;
  if (options?.delayMs != null) {
    republishPendingDelayMs = Math.max(
      options.delayMs,
      republishPendingDelayMs,
    );
  }
  if (republishDebounceTimer != null) {
    clearTimeout(republishDebounceTimer);
  }
  republishDebounceTimer = setTimeout(() => {
    republishDebounceTimer = null;
    void flushScheduledPairwiseRepublish().catch(() => undefined);
  }, republishPendingDelayMs);
}

async function flushScheduledPairwiseRepublish(): Promise<void> {
  const gc = republishPendingGc;
  const force = republishPendingForce;
  republishPendingGc = null;
  republishPendingForce = false;
  republishPendingDelayMs = REPUBLISH_DEBOUNCE_MS;
  if (!gc) return;

  const now = Date.now();
  const elapsed = now - lastRepublishCompletedAt;
  if (!force && elapsed < REPUBLISH_MIN_INTERVAL_MS) {
    scheduleRepublishLocalMediaToPairwiseCalls(gc, {
      force,
      delayMs: REPUBLISH_MIN_INTERVAL_MS - elapsed,
    });
    return;
  }

  await republishLocalMediaToPairwiseCalls(
    gc,
    force ? { force: true } : undefined,
  );
  lastRepublishCompletedAt = Date.now();
}
