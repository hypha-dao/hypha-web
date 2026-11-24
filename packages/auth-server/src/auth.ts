import { betterAuth } from 'better-auth';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import {
  allowedScopesForResource,
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  AUTH_QUERY_TTL_SECONDS,
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_CONSENT_PATH,
  AUTH_SERVER_JWKS_PATH,
  AUTH_SERVER_LOGIN_PATH,
  AUTH_SERVER_SCOPES,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_REUSE_INTERVAL_SECONDS,
  type AuthServerConfig,
} from './config';
import {
  createAuthDbPool,
  resolvePersonForIdentity,
  type AuthDbPool,
} from './db';
import { isPersonAllowed } from './gate';
import { SPACE_GRANTS_CLAIM, grantClaimFor } from './grants';
import { redactingLog } from './redact';
import { createIdentityBridge } from './identity-bridge';
import { createPrivyProvider, type ProviderRegistry } from './providers';

export type AuthServerDeps = {
  pool?: AuthDbPool;
  /** Login providers by name; production registers Privy. */
  providers?: ProviderRegistry;
  /** Replaced in tests; production uses the pinned, redirect-refusing Node transport. */
  fetchClientMetadataResource?: ClientMetadataResourceFetch;
  /** Access token lifetime override (tests). */
  accessTokenExpiresIn?: number;
};

const FORBIDDEN = {
  error: 'access_denied',
  error_description: 'This account is not enabled for this service.',
} as const;

/**
 * True only for the app's own first request to the authorize endpoint: the incoming HTTP request
 * is for that path and carries no library signature. Anything else is a resume (after sign-in
 * the query is signed; after consent the library dispatches the endpoint from the consent request).
 */
export function isInitialAuthorizeRequest(
  request: Request | undefined,
  params: unknown,
): boolean {
  if (!request) return false;
  let path: string;
  try {
    path = new URL(request.url).pathname;
  } catch {
    return false;
  }
  if (!path.endsWith('/oauth2/authorize')) return false;
  const sig = (params as Record<string, unknown> | undefined)?.sig;
  return sig === undefined || sig === null || sig === '';
}

export function createAuthServer(
  config: AuthServerConfig,
  deps: AuthServerDeps = {},
) {
  const pool = deps.pool ?? createAuthDbPool(config.databaseUrl);
  const providers: ProviderRegistry = deps.providers ?? {
    privy: createPrivyProvider(config.privyAppId, config.privyJwksUrlOverride),
  };

  const gate = (personId: string | null | undefined) =>
    isPersonAllowed(config, personId);

  const auth = betterAuth({
    baseURL: config.issuer,
    basePath: AUTH_SERVER_API_BASE_PATH,
    secret: config.secret,
    database: pool,
    // Tables are prefixed so they cannot collide with the app's own tables.
    user: { modelName: 'as_user' },
    session: { modelName: 'as_session', expiresIn: 60 * 60 * 24 },
    account: { modelName: 'as_account' },
    verification: { modelName: 'as_verification' },
    emailAndPassword: { enabled: false },
    // Second layer behind the HTTP allowlist in handler.ts: library endpoints this server must
    // never serve (client management, userinfo/introspection, sessions listing). Registration is
    // open only when AUTH_SERVER_DCR_ENABLED is "true" (restricted, see registration.ts).
    disabledPaths: [
      ...(config.dcrEnabled ? [] : ['/oauth2/register']),
      '/oauth2/create-client',
      '/oauth2/get-clients',
      '/oauth2/get-client',
      '/oauth2/update-client',
      '/oauth2/delete-client',
      '/oauth2/introspect',
      '/oauth2/userinfo',
      '/sign-up/email',
      '/sign-in/email',
      '/get-session',
      '/list-sessions',
      '/token',
    ],
    logger: { log: redactingLog },
    advanced: {
      useSecureCookies: config.issuer.startsWith('https://'),
      cookiePrefix: 'hypha_as',
      // Address tracking stays on (the library's own rate limits use it), but the client address is
      // read only from the platform header on Vercel, which the caller cannot set. Everywhere else
      // no header is trusted (the library falls back to localhost in development only).
      ipAddress: {
        disableIpTracking: false,
        ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : [],
      },
    },
    trustedOrigins: [config.issuer],
    plugins: [
      jwt({
        jwks: {
          // Own key set, published under the issuer, separate from the main host's Neon aggregator.
          jwksPath: AUTH_SERVER_JWKS_PATH,
          keyPairConfig: { alg: 'ES256' },
          rotationInterval: 60 * 60 * 24 * 90,
          gracePeriod: 60 * 60 * 24 * 30,
        },
        schema: { jwks: { modelName: 'as_jwks' } },
        jwt: {
          issuer: config.issuer,
          expirationTime: ACCESS_TOKEN_TTL_SECONDS,
          // sub is the Privy user id (= people.sub), never a separate id.
          getSubject: ({ user }) => user.id,
        },
      }),
      oauthProvider({
        loginPage: AUTH_SERVER_LOGIN_PATH,
        consentPage: AUTH_SERVER_CONSENT_PATH,
        scopes: [...AUTH_SERVER_SCOPES],
        clientRegistrationDefaultScopes: ['spaces:read'],
        clientRegistrationAllowedScopes: [...AUTH_SERVER_SCOPES],
        grantTypes: ['authorization_code', 'refresh_token'],
        // No client management over HTTP for anyone. Anonymous registration (below) never reaches
        // this hook: the handler strips cookies from register requests, so it only ever sees
        // management calls, which stay denied.
        clientPrivileges: () => false,
        resourcePrivileges: () => false,
        // Restricted dynamic registration, behind AUTH_SERVER_DCR_ENABLED: anonymous, public
        // clients only; body rules in registration.ts. Off means the library does not advertise it.
        allowDynamicClientRegistration: config.dcrEnabled,
        allowUnauthenticatedClientRegistration: config.dcrEnabled,
        // loopback http redirects make a client native, https ones web; registration.ts bounds both.
        clientRegistrationDefaultApplicationType: 'infer',
        accessTokenExpiresIn:
          deps.accessTokenExpiresIn ?? ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
        refreshTokenReuseInterval: REFRESH_TOKEN_REUSE_INTERVAL_SECONDS,
        // The library uses this one option for the signed login/consent query AND the code row's
        // expiry. It carries the (longer) query lifetime; the code is cut back to
        // AUTH_CODE_TTL_SECONDS at the token endpoint by the `hypha-code-ttl` hook below.
        codeExpiresIn: AUTH_QUERY_TTL_SECONDS,
        // Declared with their allowed scopes (E52). `merge` so a resource row that already exists
        // picks the declaration up (the default only inserts missing rows).
        resources: config.resources.map((identifier) => {
          const allowedScopes = allowedScopesForResource(identifier);
          return allowedScopes ? { identifier, allowedScopes } : { identifier };
        }),
        resourceSeedMode: 'merge',
        extensions: [
          {
            // The per-space grant the person gave this client, minted at the code exchange and
            // on every refresh (read live, so an edit applies at the next refresh). Fail
            // closed: no row means an empty list, never "all"; a person outside the allowlist
            // gets no token. The library hands this hook the client; the plugin hook below does not.
            claims: {
              accessToken: async ({ user, client }) => {
                if (!user || !gate(user.id)) {
                  throw new APIError('FORBIDDEN', FORBIDDEN);
                }
                return {
                  [SPACE_GRANTS_CLAIM]: await grantClaimFor(
                    pool,
                    user.id,
                    client.clientId,
                  ),
                };
              },
            },
          },
        ],
        // CIMD clients are unregistered, so they cannot be linked to resources one by one.
        enforcePerClientResources: false,
        // Consent is shown by our page and remembered per client and scope (the library's standard
        // behaviour): it is asked again only when a request needs a scope that was not approved yet,
        // or after the person disconnects the app. `skip_consent` cannot be set: registration drops
        // it and stored rows are written with skipConsent = false.
        customAccessTokenClaims: async ({ user }) => {
          // Runs for the code exchange and for every refresh: the whitelist re-check at refresh.
          if (!user || !gate(user.id)) {
            throw new APIError('FORBIDDEN', FORBIDDEN);
          }
          return {};
        },
        schema: {
          oauthClient: { modelName: 'as_oauth_client' },
          oauthAccessToken: { modelName: 'as_oauth_access_token' },
          oauthRefreshToken: { modelName: 'as_oauth_refresh_token' },
          oauthConsent: { modelName: 'as_oauth_consent' },
          oauthResource: { modelName: 'as_oauth_resource' },
          oauthClientResource: { modelName: 'as_oauth_client_resource' },
          oauthClientAssertion: { modelName: 'as_oauth_client_assertion' },
        },
      }),
      cimd({
        fetchClientMetadataResource:
          deps.fetchClientMetadataResource ?? fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
      createIdentityBridge({
        providers,
        gate,
        resolvePerson: (provider, id) =>
          resolvePersonForIdentity(pool, provider, id),
      }),
      {
        // Every client is an AI host that should stay connected, so a refresh token is always
        // offered: `offline_access` is added to the scopes of the app's first, unsigned authorize
        // request (the person can still untick it on the consent page). The library re-dispatches
        // the authorize endpoint after consent with the scope the person ticked, and resumes with
        // a signed query; neither may get the default back, or a declined `offline_access` would
        // reappear. The library only issues a refresh token when it is part of the granted scope.
        id: 'hypha-offline-access',
        hooks: {
          before: [
            {
              matcher: (ctx) => ctx.path === '/oauth2/authorize',
              handler: createAuthMiddleware(async (ctx) => {
                if (
                  !isInitialAuthorizeRequest(ctx.request, ctx.query ?? ctx.body)
                )
                  return;
                const target = (ctx.query ?? ctx.body) as
                  | Record<string, unknown>
                  | undefined;
                const requested = target?.scope;
                if (
                  !target ||
                  typeof requested !== 'string' ||
                  !requested.trim()
                )
                  return;
                const scopes = requested.split(/\s+/).filter(Boolean);
                if (!scopes.includes('offline_access')) {
                  target.scope = [...scopes, 'offline_access'].join(' ');
                }
              }),
            },
          ],
        },
      },
      {
        // Authorization codes live AUTH_CODE_TTL_SECONDS, not the query lifetime the library gave the
        // row. Before every token request, cap each code row's expiry at issue time + 60 s (the
        // row's updatedAt is its issue time). Idempotent; only ever shortens.
        id: 'hypha-code-ttl',
        hooks: {
          before: [
            {
              matcher: (ctx) => ctx.path === '/oauth2/token',
              handler: createAuthMiddleware(async () => {
                await pool.query(
                  `update as_verification
                      set "expiresAt" = "updatedAt" + ($1::int * interval '1 second')
                    where value like '{"type":"authorization_code"%'
                      and "expiresAt" > "updatedAt" + ($1::int * interval '1 second')`,
                  [AUTH_CODE_TTL_SECONDS],
                );
              }),
            },
          ],
        },
      },
      {
        // The library treats an omitted `scope` on consent as "grant everything requested". The
        // granted scope must be exactly what the person ticked, so an accept without one is refused.
        id: 'hypha-explicit-consent',
        hooks: {
          before: [
            {
              matcher: (ctx) => ctx.path === '/oauth2/consent',
              handler: createAuthMiddleware(async (ctx) => {
                const body = ctx.body as
                  | { accept?: unknown; scope?: unknown }
                  | undefined;
                if (body?.accept === true && typeof body.scope !== 'string') {
                  throw new APIError('BAD_REQUEST', {
                    error: 'invalid_request',
                    error_description: 'scope is required when approving',
                  });
                }
              }),
            },
          ],
        },
      },
      {
        id: 'hypha-gate',
        hooks: {
          before: [
            {
              matcher: (ctx) =>
                ctx.path === '/oauth2/authorize' ||
                ctx.path === '/oauth2/consent' ||
                ctx.path === '/oauth2/continue',
              handler: createAuthMiddleware(async (ctx) => {
                const session = await getSessionFromCtx(ctx);
                // No session yet: the library sends the person to the login page first.
                if (session && !gate(session.user.id)) {
                  throw new APIError('FORBIDDEN', FORBIDDEN);
                }
              }),
            },
          ],
        },
      },
    ],
  });

  return { auth, pool, config };
}

export type AuthServer = ReturnType<typeof createAuthServer>;
