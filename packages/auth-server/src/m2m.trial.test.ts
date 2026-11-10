/**
 * Trial check 11 (information only, #2565 D31): can the library issue a client-credentials
 * token carrying a role claim? Uses a separate, throwaway auth instance; nothing in the real
 * server enables this grant.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { decodeJwt } from 'jose';
import { createAuthDbPool } from './db';
import { TEST_DB_URL, ISSUER } from './testing/harness';

const run = TEST_DB_URL ? describe : describe.skip;

run('trial: client credentials with a role claim (information)', () => {
  const pool = TEST_DB_URL
    ? createAuthDbPool(TEST_DB_URL)
    : (undefined as never);
  afterAll(async () => {
    await pool?.end();
  });
  let auth: ReturnType<typeof make>;
  function make() {
    return betterAuth({
      baseURL: ISSUER,
      basePath: '/api/auth',
      secret: 'contract-test-secret-'.padEnd(48, 'x'),
      database: pool,
      logger: { disabled: true },
      user: { modelName: 'as_user' },
      session: { modelName: 'as_session' },
      account: { modelName: 'as_account' },
      verification: { modelName: 'as_verification' },
      plugins: [
        jwt({
          jwks: { keyPairConfig: { alg: 'ES256' } },
          schema: { jwks: { modelName: 'as_jwks' } },
          jwt: { issuer: ISSUER },
        }),
        oauthProvider({
          loginPage: '/auth/login',
          consentPage: '/auth/consent',
          scopes: ['spaces:read', 'service:read'],
          grantTypes: ['client_credentials'],
          storeClientSecret: {
            hash: async (s: string) => `h:${s}`,
            verify: async (s: string, stored: string) => stored === `h:${s}`,
          },
          resources: [`${ISSUER}/api/auth/test`],
          enforcePerClientResources: false,
          customAccessTokenClaims: async ({ user }) =>
            user ? {} : { role: 'hypha_service' },
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
      ],
    });
  }
  beforeAll(() => {
    auth = make();
  });

  it('issues a service token with a role claim', async () => {
    await pool.query('delete from as_oauth_client where "clientId" = $1', [
      'svc-client',
    ]);
    await pool.query(
      `insert into as_oauth_client (id, "clientId", "clientSecret", scopes, "clientCredentialsScopes", "redirectUris", "grantTypes", "tokenEndpointAuthMethod", name, "createdAt", "updatedAt")
       values ('svc1','svc-client','h:svc-secret','["service:read"]','["service:read"]','[]','["client_credentials"]','client_secret_basic','svc', now(), now())`,
    );
    const basic = Buffer.from('svc-client:svc-secret').toString('base64');
    const res = await auth.handler(
      new Request(`${ISSUER}/api/auth/oauth2/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${basic}`,
          host: new URL(ISSUER).host,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'service:read',
          resource: `${ISSUER}/api/auth/test`,
        }).toString(),
      }),
    );
    const body = await res.json();
    console.log('INFO m2m ->', res.status, JSON.stringify(body).slice(0, 120));
    expect(res.status).toBe(200);
    const claims = decodeJwt(body.access_token);
    console.log('INFO m2m claims:', JSON.stringify(claims));
    expect(claims.role).toBe('hypha_service');
  });
});
