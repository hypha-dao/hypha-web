import {
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_JWKS_PATH,
  type AuthServerConfig,
  type AuthServerDisabled,
} from './config';
import { blockUnlessAuthServerHost, notFound } from './gate';
import type { AuthServer } from './auth';
import { redactingLog } from './redact';

/**
 * The only HTTP surface the server exposes. Everything else Better Auth ships (client
 * management, introspection, userinfo, session and account endpoints, ...) is unreachable
 * from outside, even though the library registers it. Paths are relative to the API base path.
 */
const ALLOWED: ReadonlyArray<{ path: string; methods: readonly string[] }> = [
  { path: '/oauth2/authorize', methods: ['GET', 'POST'] },
  { path: '/oauth2/consent', methods: ['POST'] },
  { path: '/oauth2/continue', methods: ['POST'] },
  { path: '/oauth2/token', methods: ['POST'] },
  { path: '/oauth2/revoke', methods: ['POST'] },
  { path: AUTH_SERVER_JWKS_PATH, methods: ['GET'] },
  { path: '/provider/sign-in', methods: ['POST'] },
];
const WELL_KNOWN = '/.well-known/oauth-authorization-server';

export function isAllowedAuthServerPath(
  pathname: string,
  method: string,
): boolean {
  if (pathname === WELL_KNOWN) return method === 'GET' || method === 'HEAD';
  if (!pathname.startsWith(`${AUTH_SERVER_API_BASE_PATH}/`)) return false;
  const rel = pathname.slice(AUTH_SERVER_API_BASE_PATH.length);
  return ALLOWED.some((a) => a.path === rel && a.methods.includes(method));
}

/**
 * Builds the request handler used by the route files. `getServer` is lazy so that nothing
 * (database, keys) is touched until an allowed request arrives on the right host.
 */
export function createAuthServerHandler(
  getConfig: () => AuthServerConfig | AuthServerDisabled,
  getServer: (config: AuthServerConfig) => AuthServer,
) {
  return async function handle(request: Request): Promise<Response> {
    const config = getConfig();
    const blocked = blockUnlessAuthServerHost(request, config);
    if (blocked || !config.enabled) return blocked ?? notFound();
    const url = new URL(request.url);
    if (!isAllowedAuthServerPath(url.pathname, request.method.toUpperCase()))
      return notFound();
    try {
      return await getServer(config).auth.handler(request);
    } catch (error) {
      // Never echo the error: it can carry request data.
      redactingLog('error', 'request failed', error);
      return new Response(JSON.stringify({ error: 'server_error' }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      });
    }
  };
}
