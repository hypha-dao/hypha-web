import type { AuthServerConfig } from './config';

/** Whitelist of person ids (Privy user id = people.sub). Empty list allows nobody. */
export function isPersonAllowed(
  config: Pick<AuthServerConfig, 'allowedPersonIds'>,
  personId: string | null | undefined,
): boolean {
  return !!personId && config.allowedPersonIds.has(personId);
}

/**
 * Host block: the server answers only on its own host. Returns a 404 response for any other
 * host (and when the server is off), or null when the request may continue.
 * Deliberately identical for both cases so the response does not reveal which one applied.
 */
export function blockUnlessAuthServerHost(
  request: Request,
  config: AuthServerConfig | { enabled: false },
): Response | null {
  if (!config.enabled) return notFound();
  const requestHost = (request.headers.get('host') ?? new URL(request.url).host)
    .split(',')[0]!
    .trim()
    .toLowerCase();
  if (requestHost !== config.host.toLowerCase()) return notFound();
  return null;
}

export function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
