/**
 * Every `/api/integration/v1` response is bound to a credential (a person's
 * token, a client key or the ops secret) and some carry key material, so all
 * of them are `private, no-store` and vary on each credential header. A shared
 * cache must never serve one caller's body to another.
 */
export const INTEGRATION_API_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, x-hypha-client-key, x-hypha-ops-secret',
} as const;

/** Sets the cache headers on any response, replacing a looser value. */
export function applyIntegrationApiHeaders<R extends Response>(response: R): R {
  for (const [name, value] of Object.entries(
    INTEGRATION_API_RESPONSE_HEADERS,
  )) {
    response.headers.set(name, value);
  }
  return response;
}

/** A JSON response that already carries the cache headers. */
export function integrationJson(
  body: unknown,
  init?: { status?: number },
): Response {
  return applyIntegrationApiHeaders(
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

/**
 * Wraps a route handler so that every response, including an exception that
 * escaped it, carries the cache headers. A new route exports through this
 * wrapper and cannot forget them on an early return or an error path.
 */
export function withIntegrationApiHeaders<
  A extends unknown[],
  R extends Response,
>(
  handler: (...args: A) => Promise<R>,
  onUnhandled: (error: unknown) => R,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return applyIntegrationApiHeaders(await handler(...args));
    } catch (error) {
      return applyIntegrationApiHeaders(onUnhandled(error));
    }
  };
}
