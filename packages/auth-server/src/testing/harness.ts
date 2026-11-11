import { createHash, randomBytes } from 'node:crypto';
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import { createAuthServer } from '../auth';
import { loadAuthServerConfig, type AuthServerConfig } from '../config';
import { createAuthDbPool } from '../db';

export const TEST_DB_URL = process.env.AUTH_SERVER_TEST_DATABASE_URL;
export const ISSUER = 'http://auth.localhost:3000';
export const RESOURCE = `${ISSUER}/api/auth/test`;
export const CLIENT_ID = 'https://client.example.com/cimd.json';
export const REDIRECT_URI = 'https://client.example.com/callback';
export const PERSON = 'did:privy:allowed1';
export const OTHER_PERSON = 'did:privy:denied2';

export function b64url(buf: Buffer) {
  return buf.toString('base64url');
}
export function makePkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export const cimdDocument = {
  client_id: CLIENT_ID,
  client_name: 'Test AI App',
  client_uri: 'https://client.example.com',
  redirect_uris: [REDIRECT_URI],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  scope: 'spaces:read offline_access',
};

export const fakeMetadataFetch: ClientMetadataResourceFetch = async (url) => {
  if (String(url) === CLIENT_ID) {
    return new Response(JSON.stringify(cimdDocument), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'max-age=60',
      },
    });
  }
  return new Response('not found', { status: 404 });
};

export function testConfig(
  over: Record<string, string | undefined> = {},
): AuthServerConfig {
  const config = loadAuthServerConfig({
    AUTH_SERVER_ENABLED: 'true',
    AUTH_SERVER_ISSUER: ISSUER,
    AUTH_SERVER_SECRET: randomBytes(32).toString('hex'),
    DEFAULT_DB_URL: TEST_DB_URL,
    NEXT_PUBLIC_PRIVY_APP_ID: 'test-app',
    AUTH_SERVER_ALLOWED_PERSON_IDS: PERSON,
    AUTH_SERVER_RESOURCES: RESOURCE,
    ...over,
  });
  if (!config.enabled) throw new Error(config.reason);
  return config;
}

/** Fake login provider: tokens look like `ok:<provider user id>`. */
export const fakeProvider = (_name: string) => async (t: string) =>
  t.startsWith('ok:')
    ? ({ ok: true, providerUserId: t.slice(3) } as const)
    : ({ ok: false, reason: 'invalid token' } as const);

export async function makeServer(
  over: Record<string, string | undefined> = {},
  deps: Parameters<typeof createAuthServer>[1] = {},
) {
  const config = testConfig(over);
  const pool = createAuthDbPool(config.databaseUrl);
  const server = createAuthServer(config, {
    pool,
    providers: { privy: fakeProvider('privy'), other: fakeProvider('other') },
    fetchClientMetadataResource: fakeMetadataFetch,
    ...deps,
  });
  return {
    ...server,
    pool,
    handler: (req: Request) => server.auth.handler(req),
  };
}
export type Harness = Awaited<ReturnType<typeof makeServer>>;

export async function seedPeople(pool: Harness['pool'], subs: string[]) {
  for (const sub of subs) {
    await pool.query(
      `insert into people (sub, name, surname, email) values ($1,'Test','User',$2) on conflict (sub) do nothing`,
      [sub, `${sub.replace(/\W/g, '')}@example.org`],
    );
  }
}

export class CookieJar {
  private cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

export function authorizeUrl(
  pkce: { challenge: string },
  over: Record<string, string> = {},
) {
  const u = new URL(`${ISSUER}/api/auth/oauth2/authorize`);
  const q: Record<string, string> = {
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'spaces:read offline_access',
    state: 'st123',
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
    ...over,
  };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  return u;
}

export function req(
  path: string,
  init: RequestInit & { jar?: CookieJar } = {},
) {
  const headers = new Headers(init.headers);
  headers.set('host', new URL(ISSUER).host);
  if (init.jar) {
    const c = init.jar.header();
    if (c) headers.set('cookie', c);
  }
  return new Request(`${ISSUER}${path}`, {
    ...init,
    headers,
    redirect: 'manual',
  } as RequestInit);
}

export async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function signIn(
  s: Harness,
  jar: CookieJar,
  oauthQuery: string,
  person = PERSON,
) {
  const res = await s.handler(
    req('/api/auth/provider/sign-in', {
      method: 'POST',
      jar,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        origin: ISSUER,
      },
      body: JSON.stringify({
        provider: 'privy',
        token: `ok:${person}`,
        oauth_query: oauthQuery,
      }),
    }),
  );
  jar.absorb(res);
  return { res, body: await json(res) };
}

export async function consent(
  s: Harness,
  jar: CookieJar,
  oauthQuery: string,
  scope: string,
) {
  const res = await s.handler(
    req('/api/auth/oauth2/consent', {
      method: 'POST',
      jar,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        origin: ISSUER,
      },
      body: JSON.stringify({ accept: true, scope, oauth_query: oauthQuery }),
    }),
  );
  return { res, body: await json(res) };
}

export async function tokenRequest(s: Harness, params: Record<string, string>) {
  const res = await s.handler(
    req('/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    }),
  );
  return { res, body: await json(res) };
}

/** Full happy path: authorize -> login -> consent -> code exchange. Returns tokens and the jar. */
export async function fullFlow(
  s: Harness,
  opts: { person?: string; scope?: string; resource?: string } = {},
) {
  const scope = opts.scope ?? 'spaces:read offline_access';
  const resource = opts.resource ?? RESOURCE;
  const pkce = makePkce();
  const jar = new CookieJar();
  const u = authorizeUrl(pkce, { scope, resource });
  const a = await s.handler(req(u.pathname + u.search));
  const loginLoc = new URL(a.headers.get('location')!, ISSUER);
  const login = await signIn(s, jar, loginLoc.search.slice(1), opts.person);
  if (login.res.status !== 200)
    return { pkce, jar, login, stage: 'login' as const };
  let c: Awaited<ReturnType<typeof consent>> | undefined;
  let cbUrl: URL;
  const next = new URL(login.body.url, ISSUER);
  if (next.origin === new URL(REDIRECT_URI).origin) {
    cbUrl = next; // consent already given earlier: straight to the callback
  } else {
    c = await consent(s, jar, next.search.slice(1), scope);
    if (!c.body?.url)
      return { pkce, jar, login, consent: c, stage: 'consent' as const };
    cbUrl = new URL(c.body.url);
  }
  const code = cbUrl.searchParams.get('code')!;
  const t = await tokenRequest(s, {
    grant_type: 'authorization_code',
    code,
    code_verifier: pkce.verifier,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    resource,
  });
  return {
    pkce,
    jar,
    login,
    consent: c,
    cbUrl,
    token: t,
    stage: 'done' as const,
  };
}

export async function resetAsTables(pool: Harness['pool']) {
  await pool.query(
    'truncate as_identity, as_jwks, as_oauth_consent, as_oauth_access_token, as_oauth_refresh_token, as_oauth_client, as_session, as_account, as_user, as_verification restart identity cascade',
  );
}
