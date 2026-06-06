'use client';

import type { MatrixClient } from 'matrix-js-sdk';
import { evaluateMatrixTurnReadiness } from './matrix-turn-readiness';

/** Refresh TURN credentials this long before SDK-reported expiry. */
export const MATRIX_TURN_REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

/** Fallback poll when expiry is unknown (long calls). */
export const MATRIX_TURN_REFRESH_FALLBACK_MS = 30 * 60 * 1000;

export type MatrixTurnRefreshCleanup = () => void;

/**
 * Schedules `checkTurnServers()` before credentials expire so long calls and
 * screen shares do not run on stale ICE servers.
 */
export function scheduleMatrixTurnRefresh(options: {
  client: MatrixClient;
  onReadiness?: (
    readiness: Awaited<ReturnType<typeof evaluateMatrixTurnReadiness>>,
  ) => void;
}): MatrixTurnRefreshCleanup {
  const { client, onReadiness } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const scheduleNext = (delayMs: number) => {
    if (disposed) return;
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => {
      void refresh();
    }, Math.max(0, delayMs));
  };

  const refresh = async () => {
    if (disposed) return;
    try {
      const readiness = await evaluateMatrixTurnReadiness(client);
      onReadiness?.(readiness);
      const expiry = client.getTurnServersExpiry();
      const delayMs =
        Number.isFinite(expiry) && expiry > 0
          ? Math.max(
              60_000,
              expiry - Date.now() - MATRIX_TURN_REFRESH_BEFORE_EXPIRY_MS,
            )
          : MATRIX_TURN_REFRESH_FALLBACK_MS;
      scheduleNext(delayMs);
    } catch {
      scheduleNext(MATRIX_TURN_REFRESH_FALLBACK_MS);
    }
  };

  void refresh();

  return () => {
    disposed = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
