/**
 * Classifies Matrix GroupCall / getUserMedia failures for UI (permission vs other).
 * @public
 */
export function isPermissionLikeGroupCallError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as { code?: string }).code);
    if (code === 'no_user_media') return true;
  }
  if (e instanceof Error) {
    const name = e.name;
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDismissedError' /* experimental */ ||
      name === 'SecurityError' ||
      name === 'NotReadableError' ||
      name === 'OverconstrainedError'
    ) {
      return true;
    }
    const m = e.message.toLowerCase();
    return (
      m.includes('notallowederror') ||
      m.includes('permission') ||
      m.includes('not allowed')
    );
  }
  return false;
}

/** True when the homeserver rejected the request for rate limiting (HTTP 429 / M_LIMIT_EXCEEDED). */
export function isMatrixRateLimitedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & {
    httpStatus?: number;
    errcode?: string;
    data?: { errcode?: string; retry_after_ms?: number };
  };
  if (e.httpStatus === 429) return true;
  const msg = e.message;
  if (msg.includes('[429]') || msg.includes(' 429 ')) return true;
  if (e.errcode === 'M_LIMIT_EXCEEDED') return true;
  if (e.data?.errcode === 'M_LIMIT_EXCEEDED') return true;
  if (/too many requests/i.test(msg)) return true;
  return false;
}

/**
 * Non-permission GroupCall errors during an active capture session are often
 * transient (homeserver 429, SDK "multiple calls" races). Teardown would stop
 * recording while the user is still in the call.
 */
export function shouldIgnoreGroupCallErrorDuringCapture(
  err: unknown,
  captureActive: boolean,
): boolean {
  if (isPermissionLikeGroupCallError(err)) return false;
  if (isMatrixRateLimitedError(err)) return true;
  return captureActive;
}
