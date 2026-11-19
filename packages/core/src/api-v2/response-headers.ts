/**
 * v2 responses depend on who asks (the viewer-aware list, the access gate and
 * every `my-*` route), so they are `private` and vary on both credential
 * headers: a shared cache must never serve one caller's body to another.
 */
export const V2_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, x-hypha-client-key',
} as const;

/** Sets the v2 cache headers on any response, replacing a looser value. */
export function applyV2Headers<R extends Response>(response: R): R {
  for (const [name, value] of Object.entries(V2_RESPONSE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * Wraps a v2 route handler so that every response carries the v2 cache
 * headers, whatever path produced it: success, a 4xx/5xx built by the handler,
 * or an exception that escaped it (answered with a 500 that has no detail). A
 * new route exports its handler through this wrapper and cannot forget the
 * headers on an early return or an error path.
 */
export function withV2Headers<A extends unknown[], R extends Response>(
  handler: (...args: A) => Promise<R>,
  onUnhandled: (error: unknown) => R,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return applyV2Headers(await handler(...args));
    } catch (error) {
      return applyV2Headers(onUnhandled(error));
    }
  };
}
