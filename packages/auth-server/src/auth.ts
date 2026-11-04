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
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_CONSENT_PATH,
  AUTH_SERVER_LOGIN_PATH,
  AUTH_SERVER_SCOPES,
  REFRESH_TOKEN_TTL_SECONDS,
  type AuthServerConfig,
} from './config';
import { createAuthDbPool, findPersonBySub, type AuthDbPool } from './db';
import { isPersonAllowed } from './gate';
import { redactingLog } from './redact';
import { createPrivyBridge } from './privy-bridge';
import { createPrivyTokenVerifier, type PrivyTokenVerifier } from './privy';

export type AuthServerDeps = {
  pool?: AuthDbPool;
  verifyPrivyToken?: PrivyTokenVerifier;
  /** Replaced in tests; production uses the pinned, redirect-refusing Node transport. */
  fetchClientMetadataResource?: ClientMetadataResourceFetch;
  /** Access token lifetime override (tests). */
  accessTokenExpiresIn?: number;
};

const FORBIDDEN = {
  error: 'access_denied',
  error_description: 'This account is not enabled for this service.',
} as const;

export function createAuthServer(
  config: AuthServerConfig,
  deps: AuthServerDeps = {},
) {
  const pool = deps.pool ?? createAuthDbPool(config.databaseUrl);
  const verifyPrivyToken =
    deps.verifyPrivyToken ?? createPrivyTokenVerifier(config.privyAppId);

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
    logger: { log: redactingLog },
    advanced: {
      useSecureCookies: config.issuer.startsWith('https://'),
      cookiePrefix: 'hypha_as',
      // Do not trust client-supplied forwarding headers for the client address.
      ipAddress: { disableIpTracking: false },
    },
    trustedOrigins: [config.issuer],
    plugins: [
      jwt({
        jwks: {
          // Own key set, published under the issuer, separate from the main host's Neon aggregator.
          jwksPath: '/jwks',
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
        // No client management over HTTP for anyone: clients are CIMD documents only.
        clientPrivileges: () => false,
        resourcePrivileges: () => false,
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        accessTokenExpiresIn:
          deps.accessTokenExpiresIn ?? ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
        codeExpiresIn: AUTH_CODE_TTL_SECONDS,
        resources: [...config.resources],
        // CIMD clients are unregistered, so they cannot be linked to resources one by one.
        enforcePerClientResources: false,
        // Authorization-code consent is shown by our page; the server never skips it.
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
      createPrivyBridge({
        verifyPrivyToken,
        gate,
        findPerson: (sub) => findPersonBySub(pool, sub),
      }),
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
