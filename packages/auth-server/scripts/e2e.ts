/**
 * End-to-end check against a running app (next dev / next start), written to follow the MCP
 * authorization flow the way an AI host does, except that the browser steps are API calls:
 * discovery -> authorize -> login (dev Privy keys) -> consent page -> consent -> code + PKCE ->
 * token with `resource` -> protected route -> refresh -> disconnect.
 *
 * Local only. It starts a tiny JWKS server that stands in for Privy's public keys (the app must
 * run with AUTH_SERVER_DEV_PRIVY_JWKS_URL pointing at it) and inserts one plain OAuth client row,
 * because Client ID Metadata Documents need a public https URL that this machine does not have.
 *
 *   AUTH_SERVER_TEST_DATABASE_URL=postgresql://... E2E_PRIVY_APP_ID=... \
 *   E2E_BASE=http://127.0.0.1:3000 E2E_HOST=auth.localhost:3000 npx tsx scripts/e2e.ts
 */
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import pg from 'pg';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3000';
const AS_HOST = process.env.E2E_HOST ?? 'auth.localhost:3000';
const ISSUER = `http://${AS_HOST}`;
const DB = process.env.AUTH_SERVER_TEST_DATABASE_URL!;
const APP_ID = process.env.E2E_PRIVY_APP_ID!;
const PERSON = 'did:privy:allowed1';
const CLIENT_ID = 'e2e-client';
const REDIRECT = 'http://127.0.0.1:8976/callback';
const RESOURCE = `${ISSUER}/api/auth/test`;

if (!DB || !APP_ID)
  throw new Error('set AUTH_SERVER_TEST_DATABASE_URL and E2E_PRIVY_APP_ID');

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push([name, ok, detail]);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`,
  );
};

const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = {
  ...(await exportJWK(publicKey)),
  alg: 'ES256',
  kid: 'e2e',
  use: 'sig',
};
const jwksServer = http
  .createServer((_, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  })
  .listen(4010, '127.0.0.1');

const privyToken = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: 'e2e' })
  .setSubject(PERSON)
  .setIssuer('privy.io')
  .setAudience(APP_ID)
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(privateKey);

const pool = new pg.Pool({ connectionString: DB });
await pool.query(
  `insert into people (sub, name, surname, email) values ($1,'E2E','Person','e2e@example.org') on conflict (sub) do nothing`,
  [PERSON],
);
await pool.query('delete from as_oauth_client where "clientId" = $1', [
  CLIENT_ID,
]);
await pool.query(
  `insert into as_oauth_client (id, "clientId", scopes, "redirectUris", "grantTypes", "responseTypes", "tokenEndpointAuthMethod", name, uri, "requirePKCE", "createdAt", "updatedAt")
   values ('e2e1', $1, '["spaces:read","offline_access"]', $2, '["authorization_code","refresh_token"]', '["code"]', 'none', 'E2E AI App', 'http://127.0.0.1:8976', true, now(), now())`,
  [CLIENT_ID, JSON.stringify([REDIRECT])],
);

type Res = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: () => Promise<string>;
  json: () => Promise<any>;
  location: () => string;
  setCookie: () => string[];
};

/** node:http instead of fetch: fetch drops a custom Host header, and the host is what we test. */
const call = (
  path: string,
  init: {
    method?: string;
    host?: string;
    cookie?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<Res> =>
  new Promise((resolve, reject) => {
    const u = new URL(BASE);
    const headers: Record<string, string> = {
      host: init.host ?? AS_HOST,
      ...init.headers,
    };
    if (init.cookie) headers.cookie = init.cookie;
    if (init.body)
      headers['content-length'] = String(Buffer.byteLength(init.body));
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path,
        method: init.method ?? 'GET',
        headers,
      },
      (r) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: r.statusCode ?? 0,
            headers: r.headers,
            text: async () => body,
            json: async () => JSON.parse(body),
            location: () => String(r.headers.location ?? ''),
            setCookie: () =>
              (r.headers['set-cookie'] as string[] | undefined) ?? [],
          });
        });
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });

try {
  // 1. discovery
  let res = await call('/.well-known/oauth-authorization-server');
  const meta = await res.json();
  check(
    'metadata under the issuer, path-less',
    res.status === 200 && meta.issuer === ISSUER,
    `issuer=${meta.issuer}`,
  );
  check(
    'metadata advertises S256, CIMD, iss',
    meta.code_challenge_methods_supported?.[0] === 'S256' &&
      meta.client_id_metadata_document_supported === true &&
      meta.authorization_response_iss_parameter_supported === true,
  );
  res = await call(new URL(meta.jwks_uri).pathname);
  const jwks = await res.json();
  check(
    'AS JWKS resolves under the issuer',
    res.status === 200 && jwks.keys?.length >= 1,
    `kid=${jwks.keys?.[0]?.kid}`,
  );

  // 2. host block
  for (const host of ['localhost:3000', 'example.com']) {
    const a = await call('/.well-known/oauth-authorization-server', { host });
    const b = await call('/api/auth/jwks.json', { host });
    const c = await call('/auth/login', { host });
    check(
      `404 on other host ${host} (metadata, jwks, login page)`,
      a.status === 404 && b.status === 404 && c.status === 404,
      `${a.status}/${b.status}/${c.status}`,
    );
  }

  // 3. protected route without a token
  res = await call('/api/auth/test');
  check(
    'protected route: 401 without token',
    res.status === 401,
    String(res.headers['www-authenticate'] ?? ''),
  );

  // 4. authorize -> login page
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: 'spaces:read offline_access',
    state: 's1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
  });
  res = await call(`/api/auth/oauth2/authorize?${q}`);
  const loginLoc = new URL(res.location(), ISSUER);
  check(
    'authorize without session redirects to our login page',
    res.status === 302 && loginLoc.pathname === '/auth/login',
  );
  res = await call(`/auth/login${loginLoc.search}`);
  const loginHtml = await res.text();
  check(
    'login page renders on the AS host',
    res.status === 200 && loginHtml.includes('Connect an app to Hypha'),
    `status=${res.status}`,
  );

  // 5. sign in (bridge) with a Privy-style token
  res = await call('/api/auth/provider/sign-in', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: ISSUER,
    },
    body: JSON.stringify({
      provider: 'privy',
      token: privyToken,
      oauth_query: loginLoc.search.slice(1),
    }),
  });
  const signIn = await res.json();
  const cookie = res
    .setCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  check(
    'Privy token verified, AS session opened, redirected to consent',
    res.status === 200 &&
      String(signIn.url).startsWith('/auth/consent') &&
      !!cookie,
  );
  const bad = await call('/api/auth/provider/sign-in', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: ISSUER,
    },
    body: JSON.stringify({
      provider: 'privy',
      token: 'eyJhbGciOiJFUzI1NiJ9.eyJ4IjoxfQ.AAAAAAAA',
      oauth_query: loginLoc.search.slice(1),
    }),
  });
  check('invalid Privy token rejected', bad.status === 401, String(bad.status));

  // 6. consent page, then consent
  res = await call(signIn.url, { cookie });
  const consentHtml = await res.text();
  check(
    'consent page shows app name, unverified warning, scopes',
    res.status === 200 &&
      consentHtml.includes('E2E AI App') &&
      consentHtml.includes('has not verified') &&
      consentHtml.includes('Read Hypha spaces'),
    `status=${res.status}`,
  );
  const noCookie = await call(signIn.url);
  check(
    'consent page without session does not render the app details',
    noCookie.status !== 200 || !(await noCookie.text()).includes('E2E AI App'),
    String(noCookie.status),
  );
  res = await call('/api/auth/oauth2/consent', {
    method: 'POST',
    cookie,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: ISSUER,
    },
    body: JSON.stringify({
      accept: true,
      scope: 'spaces:read offline_access',
      oauth_query: new URL(signIn.url, ISSUER).search.slice(1),
    }),
  });
  const consent = await res.json();
  const cb = new URL(consent.url);
  check(
    'code returned to the redirect URI with state and iss',
    cb.origin + cb.pathname === REDIRECT &&
      cb.searchParams.get('state') === 's1' &&
      cb.searchParams.get('iss') === ISSUER,
  );

  // 7. token
  res = await call('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: cb.searchParams.get('code')!,
      code_verifier: verifier,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      resource: RESOURCE,
    }).toString(),
  });
  const tok = await res.json();
  check(
    'token issued with refresh token',
    res.status === 200 && !!tok.access_token && !!tok.refresh_token,
  );

  // 8. protected route with the token
  res = await call('/api/auth/test', {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  const who = await res.json();
  check(
    'protected route accepts the token: sub, clientId, scopes, aud',
    res.status === 200 &&
      who.sub === PERSON &&
      who.clientId === CLIENT_ID &&
      who.aud?.[0] === RESOURCE &&
      who.scopes?.includes('spaces:read'),
    JSON.stringify(who),
  );
  res = await call('/api/auth/test', {
    host: 'localhost:3000',
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  check('protected route is 404 on the main host', res.status === 404);

  // 9. refresh, then disconnect
  res = await call('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tok.refresh_token,
      client_id: CLIENT_ID,
      resource: RESOURCE,
    }).toString(),
  });
  const tok2 = await res.json();
  check('refresh works', res.status === 200 && !!tok2.access_token);
  await pool.query(
    'delete from as_oauth_refresh_token where "userId" = $1 and "clientId" = $2',
    [PERSON, CLIENT_ID],
  );
  res = await call('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tok2.refresh_token ?? tok.refresh_token,
      client_id: CLIENT_ID,
      resource: RESOURCE,
    }).toString(),
  });
  check(
    'refresh fails after the refresh records are deleted',
    res.status >= 400,
  );
} finally {
  jwksServer.close();
  await pool.end();
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
