import {
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_JWKS_PATH,
  type AuthServerConfig,
  type AuthServerDisabled,
} from './config';
import { blockUnlessAuthServerHost, notFound } from './gate';
import type { AuthServer } from './auth';
import { redactingLog } from './redact';
import { corsPreflight, withCors } from './cors';
import { guardRegistration, narrowRegisteredClient } from './registration';

/**
 * The only HTTP surface the server exposes. Everything else Better Auth ships (client
 * management, introspection, userinfo, session and account endpoints, ...) is unreachable
 * from outside, even though the library registers it. Paths are relative to the API base path.
 */
const REGISTER_PATH = '/oauth2/register';
const ALLOWED: ReadonlyArray<{ path: string; methods: readonly string[] }> = [
  { path: '/oauth2/authorize', methods: ['GET', 'POST'] },
  { path: '/oauth2/consent', methods: ['POST'] },
  { path: '/oauth2/continue', methods: ['POST'] },
  { path: '/oauth2/token', methods: ['POST'] },
  { path: '/oauth2/revoke', methods: ['POST'] },
  // Restricted dynamic client registration (guarded in registration.ts); served only when
  // AUTH_SERVER_DCR_ENABLED is "true" (see isAllowedAuthServerPath).
  { path: REGISTER_PATH, methods: ['POST'] },
  { path: AUTH_SERVER_JWKS_PATH, methods: ['GET'] },
  { path: '/provider/sign-in', methods: ['POST'] },
];
const WELL_KNOWN = '/.well-known/oauth-authorization-server';

export function isAllowedAuthServerPath(
  pathname: string,
  method: string,
  dcrEnabled = false,
): boolean {
  if (pathname === WELL_KNOWN) return method === 'GET' || method === 'HEAD';
  if (!pathname.startsWith(`${AUTH_SERVER_API_BASE_PATH}/`)) return false;
  const rel = pathname.slice(AUTH_SERVER_API_BASE_PATH.length);
  if (rel === REGISTER_PATH && !dcrEnabled) return false;
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
    if (request.method.toUpperCase() === 'OPTIONS') {
      // Preflight: answered only where cross-origin access is deliberate, plain 404 elsewhere.
      return corsPreflight(request, config) ?? notFound();
    }
    if (
      !isAllowedAuthServerPath(
        url.pathname,
        request.method.toUpperCase(),
        config.dcrEnabled,
      )
    )
      return notFound();
    try {
      const server = getServer(config);
      const response =
        url.pathname === WELL_KNOWN
          ? await metadataWithoutDisabledEndpoints(
              server,
              request,
              config.dcrEnabled,
            )
          : url.pathname === `${AUTH_SERVER_API_BASE_PATH}/oauth2/register`
          ? await handleRegistration(server, request)
          : await server.auth.handler(request);
      return withCors(request, response, config);
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

/**
 * The library advertises introspection, but that path is disabled and not in the allowlist. Do not
 * advertise endpoints this server does not serve.
 */
async function metadataWithoutDisabledEndpoints(
  server: AuthServer,
  request: Request,
  dcrEnabled: boolean,
): Promise<Response> {
  const res = await server.auth.handler(request);
  if (res.status !== 200) return res;
  const meta = (await res.json()) as Record<string, unknown>;
  for (const key of Object.keys(meta))
    if (key.startsWith('introspection_endpoint')) delete meta[key];
  // Belt and braces: never advertise registration unless it is on.
  if (!dcrEnabled) delete meta.registration_endpoint;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(meta), { status: 200, headers });
}

async function handleRegistration(
  server: AuthServer,
  request: Request,
): Promise<Response> {
  const verdict = await guardRegistration(request, server.pool);
  if (!verdict.ok) return verdict.response;
  const res = await server.auth.handler(verdict.request);
  if (res.status !== 201) return res;
  // Narrow what was stored and what is reported to the scopes the profile granted.
  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.client_id === 'string') {
    await narrowRegisteredClient(server.pool, body.client_id, verdict.scopes);
    body.scope = verdict.scopes.join(' ');
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(body), { status: 201, headers });
}
