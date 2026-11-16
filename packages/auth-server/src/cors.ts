import { AUTH_SERVER_API_BASE_PATH, AUTH_SERVER_JWKS_PATH } from './config';
import type { AuthServerConfig } from './config';

/**
 * Cross-origin access for browser-based MCP clients, as narrow as the flow allows:
 * - metadata and JWKS (public documents, GET/HEAD): any origin (`*`), no credentials;
 * - token and registration (POST): only origins listed in AUTH_SERVER_CORS_ORIGINS (default
 *   empty), echoed back with `Vary: Origin`, no credentials, only Content-Type as request header;
 * - everything else (authorize, consent, sign-in, revoke, ...): no CORS headers at all.
 * Cookies are never allowed cross-origin (no Access-Control-Allow-Credentials anywhere).
 */
const WELL_KNOWN = '/.well-known/oauth-authorization-server';
const API = AUTH_SERVER_API_BASE_PATH;

type Policy = { methods: readonly string[]; any: boolean };
type CorsConfig = Pick<AuthServerConfig, 'corsAllowedOrigins' | 'dcrEnabled'>;

const POLICIES: Record<string, Policy> = {
  [WELL_KNOWN]: { methods: ['GET', 'HEAD'], any: true },
  [`${API}${AUTH_SERVER_JWKS_PATH}`]: { methods: ['GET', 'HEAD'], any: true },
  [`${API}/oauth2/token`]: { methods: ['POST'], any: false },
  [`${API}/oauth2/register`]: { methods: ['POST'], any: false },
};
const REGISTER = `${API}/oauth2/register`;

/** Registration gets no CORS at all while DCR is off. */
function policyFor(pathname: string, config: CorsConfig): Policy | undefined {
  if (pathname === REGISTER && !config.dcrEnabled) return undefined;
  return POLICIES[pathname];
}

const MAX_AGE = '600';

function allowedOrigin(
  policy: Policy,
  origin: string | null,
  config: CorsConfig,
): string | null {
  if (policy.any) return '*';
  if (origin && config.corsAllowedOrigins.includes(origin)) return origin;
  return null;
}

function baseHeaders(policy: Policy, allow: string): Headers {
  const headers = new Headers({ 'access-control-allow-origin': allow });
  if (!policy.any) headers.append('vary', 'Origin');
  return headers;
}

/** Answer to an OPTIONS request, or null when this path/origin gets no CORS (plain 404 then). */
export function corsPreflight(
  request: Request,
  config: CorsConfig,
): Response | null {
  const policy = policyFor(new URL(request.url).pathname, config);
  if (!policy) return null;
  const allow = allowedOrigin(policy, request.headers.get('origin'), config);
  const method = request.headers.get('access-control-request-method');
  if (!allow || !method || !policy.methods.includes(method.toUpperCase()))
    return null;
  const headers = baseHeaders(policy, allow);
  headers.set('access-control-allow-methods', [...policy.methods].join(', '));
  headers.set('access-control-allow-headers', 'Content-Type');
  headers.set('access-control-max-age', MAX_AGE);
  headers.set('cache-control', 'no-store');
  return new Response(null, { status: 204, headers });
}

/** Adds the CORS headers a real (non-preflight) response is entitled to. */
export function withCors(
  request: Request,
  response: Response,
  config: CorsConfig,
): Response {
  const policy = policyFor(new URL(request.url).pathname, config);
  if (!policy) return response;
  const allow = allowedOrigin(policy, request.headers.get('origin'), config);
  const headers = new Headers(response.headers);
  if (!policy.any) headers.append('vary', 'Origin');
  if (!allow) return rewrap(response, headers);
  headers.set('access-control-allow-origin', allow);
  return rewrap(response, headers);
}

function rewrap(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
