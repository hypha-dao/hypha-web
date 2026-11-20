/**
 * Response headers of the hosted MCP server (K20). Its answers depend on who asks, so they
 * are `private`, and vary on the bearer token only (no client key). Every answer carries
 * them, whatever path produced it: success, a refusal, a 404, or an exception that escaped the
 * handler (answered with a 500 that has no detail). Route files export their methods through
 * `mcpRoute` and build no response themselves; a contract test enforces both.
 */
export const MCP_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization',
} as const;

export function applyMcpHeaders<R extends Response>(response: R): R {
  for (const [name, value] of Object.entries(MCP_RESPONSE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export function mcpRoute<A extends unknown[], R extends Response>(
  handler: (...args: A) => Promise<R>,
  onUnhandled: (error: unknown) => R,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return applyMcpHeaders(await handler(...args));
    } catch (error) {
      return applyMcpHeaders(onUnhandled(error));
    }
  };
}
