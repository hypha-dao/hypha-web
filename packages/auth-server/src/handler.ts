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
import { authServerErrorPage } from './error-page';
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
    const method = request.method.toUpperCase();
    if (
      url.pathname === `${AUTH_SERVER_API_BASE_PATH}/error` &&
      (method === 'GET' || method === 'HEAD')
    ) {
      // Where the library sends errors it cannot return to the app; served here, never by the library.
      return authServerErrorPage(request);
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
          : url.pathname === `${AUTH_SERVER_API_BASE_PATH}/oauth2/consent`
          ? await handleConsent(server, request)
          : await server.auth.handler(request);
      return withCors(request, response, config);
    } catch (error) {
      // Never echo the error: it can carry request data.
      redactingLog('error', 'request failed', error);
      // Through withCors like every other answer, so a browser client can read the error.
      return withCors(
        request,
        new Response(JSON.stringify({ error: 'server_error' }), {
          status: 500,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        }),
        config,
      );
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
  // HEAD answers 200 with an empty body: nothing to filter, and parsing it would fail.
  if (res.status !== 200 || request.method.toUpperCase() === 'HEAD') return res;
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

/**
 * An approval grants access to the account that submits it. The page shows one account; a sign-in
 * in another tab can swap the session cookie before the person clicks. The page therefore sends
 * the id of the account it showed, and an approval from any other session is refused before
 * anything is stored. The field is required and never reaches the library.
 */
async function handleConsent(
  server: AuthServer,
  request: Request,
): Promise<Response> {
  const refuse = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await request.text());
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return refuse(400, 'invalid_request');
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse(400, 'invalid_request');
  }
  const expected = body.expected_person;
  if (typeof expected !== 'string' || !expected)
    return refuse(400, 'invalid_request');
  const session = await server.auth.api.getSession({
    headers: request.headers,
  });
  if (!session || session.user.id !== expected)
    return refuse(409, 'account_changed');
  delete body.expected_person;
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return server.auth.handler(
    new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
}
