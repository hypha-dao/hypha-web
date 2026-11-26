import {
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_JWKS_PATH,
  SCOPES_REQUIRING_SPACES_READ,
  type AuthServerConfig,
  type AuthServerDisabled,
} from './config';
import { blockUnlessAuthServerHost, notFound } from './gate';
import type { AuthServer } from './auth';
import { redactingLog } from './redact';
import { corsPreflight, withCors } from './cors';
import { authServerErrorPage } from './error-page';
import { guardRegistration, narrowRegisteredClient } from './registration';
import { logOnboardingStep, onboardingStepOf } from './onboarding-log';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import {
  GrantError,
  type GrantValue,
  assertSpacesExist,
  parseGrantInput,
  writeGrant,
} from './grants';

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
    // One allow-listed log line per authorize / consent / token step (see onboarding-log.ts),
    // also when the step fails with a server error.
    const step = onboardingStepOf(url.pathname, method);
    const requestCopy = step ? request.clone() : null;
    let server: AuthServer | undefined;
    try {
      server = getServer(config);
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
      if (step && requestCopy)
        await logOnboardingStep({
          step,
          requestCopy,
          response,
          pool: server.pool,
        });
      return withCors(request, response, config);
    } catch (error) {
      // Never echo the error: it can carry request data.
      redactingLog('error', 'request failed', error);
      const failure = new Response(JSON.stringify({ error: 'server_error' }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      });
      // Only the step and the error code are logged, never the exception or the request.
      if (step && requestCopy)
        await logOnboardingStep({
          step,
          requestCopy,
          response: failure.clone(),
          pool: server?.pool,
        });
      // Through withCors like every other answer, so a browser client can read the error.
      return withCors(request, failure, config);
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
  const spaceGrants = body.space_grants;
  delete body.space_grants;

  // Which spaces the app may read. Only an approval carries one, and the choice is stored for
  // the person of the session and the client of the SIGNED authorization query: the app cannot
  // choose or change it (it is not part of the query) and a body naming another person or
  // client is not read. The choice is checked before the library runs but only written once the
  // library has accepted the consent, and before the response (which carries the code) is
  // returned: a refused approval never touches the stored grant, and the code cannot be
  // exchanged before the browser has received it.
  let pending: {
    personId: string;
    clientId: string;
    value: GrantValue;
  } | null = null;
  if (body.accept === true) {
    const oauthQuery =
      typeof body.oauth_query === 'string' ? body.oauth_query : '';
    const clientId = new URLSearchParams(oauthQuery).get('client_id') ?? '';
    if (!clientId) return refuse(400, 'invalid_request');
    // The choice only means something next to the scope that is approved: an approval has to
    // name it (the library would otherwise grant everything the query asked for).
    if (typeof body.scope !== 'string' || !body.scope.trim())
      return refuse(400, 'invalid_request');
    const approved = body.scope.split(/\s+/).filter(Boolean);
    // A write scope that acts in the chosen spaces is approved only together with the read scope
    // the spaces are chosen under: without it there would be no choice to act in.
    if (
      approved.some((scope) =>
        (SCOPES_REQUIRING_SPACES_READ as readonly string[]).includes(scope),
      ) &&
      !approved.includes('spaces:read')
    )
      return refuse(400, 'invalid_request');
    if (!(await verifyOAuthQueryParams(oauthQuery, server.config.secret)))
      return refuse(400, 'invalid_signature');
    try {
      const value = parseGrantInput(spaceGrants);
      if (value !== 'all') await assertSpacesExist(server.pool, value);
      // Without the read scope there is nothing to limit, and an existing refresh token may
      // still carry it: leave the stored grant alone rather than replace it.
      const approvesRead = approved.includes('spaces:read');
      if (approvesRead)
        pending = { personId: session.user.id, clientId, value };
    } catch (error) {
      if (error instanceof GrantError) return refuse(400, error.code);
      throw error;
    }
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const response = await server.auth.handler(
    new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
  if (pending && response.ok) {
    try {
      await writeGrant(
        server.pool,
        pending.personId,
        pending.clientId,
        pending.value,
      );
    } catch {
      // The code in this response is never delivered and the previous grant stays in force. The
      // library has already stored the consent, which would let the next authorization skip the
      // picker and use that previous grant: drop it (best effort) so the person is asked again.
      await server.pool
        .query(
          'delete from as_oauth_consent where "userId" = $1 and "clientId" = $2',
          [pending.personId, pending.clientId],
        )
        .catch(() => undefined);
      return refuse(500, 'server_error');
    }
  }
  return response;
}
