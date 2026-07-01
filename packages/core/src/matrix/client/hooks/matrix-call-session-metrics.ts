/** Proactive in-call Matrix token refresh cadence (WCUX-SESSION-1). */
export const MATRIX_CALL_PROACTIVE_REFRESH_FALLBACK_MS = 25 * 60 * 1000;
export const MATRIX_CALL_PROACTIVE_REFRESH_BUFFER_MS = 10 * 60 * 1000;

export type MatrixCallSessionMetrics = {
  tokenRefreshCount: number;
  lastMatrixError: string | null;
};

let tokenRefreshCount = 0;
let lastMatrixError: string | null = null;

export function resolveMatrixCallProactiveRefreshIntervalMs(
  expiresInSec: number | null | undefined,
): number {
  if (typeof expiresInSec === 'number' && Number.isFinite(expiresInSec)) {
    const intervalMs =
      expiresInSec * 1000 - MATRIX_CALL_PROACTIVE_REFRESH_BUFFER_MS;
    return Math.max(60_000, intervalMs);
  }
  return MATRIX_CALL_PROACTIVE_REFRESH_FALLBACK_MS;
}

export function recordMatrixCallTokenRefreshSuccess(): void {
  tokenRefreshCount += 1;
  lastMatrixError = null;
}

export function recordMatrixCallTokenRefreshFailure(error: unknown): void {
  lastMatrixError =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'matrix_token_refresh_failed';
}

export function recordMatrixCallSessionError(error: unknown): void {
  recordMatrixCallTokenRefreshFailure(error);
}

export function getMatrixCallSessionMetrics(): MatrixCallSessionMetrics {
  return { tokenRefreshCount, lastMatrixError };
}

export function resetMatrixCallSessionMetrics(): void {
  tokenRefreshCount = 0;
  lastMatrixError = null;
}

/** Test-only reset for module state between vitest cases. */
export function resetMatrixCallSessionMetricsForTests(): void {
  resetMatrixCallSessionMetrics();
}
