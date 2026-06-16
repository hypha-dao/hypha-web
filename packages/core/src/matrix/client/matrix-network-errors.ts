function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message.trim();
    if (typeof record.error === 'string') return record.error.trim();
  }
  return String(error ?? '').trim();
}

function readErrorCauseMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.cause) return '';
  return readErrorMessage(error.cause);
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

const TRANSIENT_NETWORK_NEEDLES = [
  'network',
  'fetch failed',
  'failed to fetch',
  'err_network_io_suspended',
  'err_network_changed',
  'connectionerror',
  'connection error',
  'connection reset',
  'connection refused',
  'network request failed',
  'load failed',
  'the internet connection appears to be offline',
  'networkerror when attempting to fetch resource',
  'socket hang up',
  'econnreset',
  'enotfound',
  'etimedout',
  'timeout',
  'timed out',
  'abort',
  'aborted',
];

const AUTH_ERROR_NEEDLES = [
  'm_unknown_token',
  'unknown token',
  'soft_logout',
  'unauthorized',
  'invalid token',
];

/** True for browser/network blips that should recover without a full app crash. */
export function isTransientMatrixNetworkError(error: unknown): boolean {
  const combined = [readErrorMessage(error), readErrorCauseMessage(error)]
    .filter(Boolean)
    .join(' ');

  if (!combined.trim()) return false;
  if (includesAny(combined, AUTH_ERROR_NEEDLES)) return false;
  return includesAny(combined, TRANSIENT_NETWORK_NEEDLES);
}

/** Shared helper for root error boundaries and Matrix sync recovery. */
export function isTransientAppNetworkError(error: unknown): boolean {
  return isTransientMatrixNetworkError(error);
}
