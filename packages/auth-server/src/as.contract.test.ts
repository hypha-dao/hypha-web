import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createLocalJWKSet, decodeJwt, generateKeyPair, SignJWT } from 'jose';
import * as h from './testing/harness';
import { createAuthServerHandler } from './handler';
import { AccessTokenError, verifyAccessToken } from './verify';
import { redactSecrets } from './redact';
import { isPersonAllowed } from './gate';
import { disconnectApp, listConnectedApps } from './connected-apps';
import { loadAuthServerConfig } from './config';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'contract-test-secret-'.padEnd(48, 'x');
const OTHER = {
  AUTH_SERVER_SECRET: SECRET,
  AUTH_SERVER_ALLOWED_PERSON_IDS: 'did:privy:somebody-else',
};

run('authorization server: protocol, gate, revocation, storage', () => {
  let s: h.Harness;
  beforeAll(async () => {
    s = await h.makeServer({ AUTH_SERVER_SECRET: SECRET });
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON, h.OTHER_PERSON]);
  });
  afterAll(async () => {
    await s.pool.end();
  });

  async function keys() {
    const res = await s.handler(h.req('/api/auth/jwks'));
    return createLocalJWKSet(await res.json());
  }

  it('issues a signed access token: sub = Privy id, aud from resource, client id, scopes, iss', async () => {
    const f = await h.fullFlow(s);
    expect(f.stage).toBe('done');
    expect(f.cbUrl!.searchParams.get('iss')).toBe(h.ISSUER);
    expect(f.cbUrl!.searchParams.get('state')).toBe('st123');
    const claims = decodeJwt(f.token!.body.access_token);
    expect(claims.sub).toBe(h.PERSON);
    expect(claims.aud).toBe(h.RESOURCE);
    expect(claims.iss).toBe(h.ISSUER);
    expect(claims.client_id).toBe(h.CLIENT_ID);
    expect(String(claims.scope).split(' ').sort()).toEqual([
      'offline_access',
      'spaces:read',
    ]);
    expect(f.token!.body.refresh_token).toBeTruthy();
    expect(f.token!.body.expires_in).toBeLessThanOrEqual(600);
  });

  it('resource side: verifyAccessToken returns {sub, clientId, scopes, aud} and enforces audience and issuer', async () => {
    const f = await h.fullFlow(s);
    const token = f.token!.body.access_token as string;
    const verified = await verifyAccessToken(token, {
      audience: h.RESOURCE,
      issuer: h.ISSUER,
      keys: await keys(),
    });
    expect(verified).toEqual({
      sub: h.PERSON,
      clientId: h.CLIENT_ID,
      scopes: expect.arrayContaining(['spaces:read']),
      aud: [h.RESOURCE],
    });
    await expect(
      verifyAccessToken(token, {
        audience: 'https://other.example.com/mcp',
        issuer: h.ISSUER,
        keys: await keys(),
      }),
    ).rejects.toBeInstanceOf(AccessTokenError);
    await expect(
      verifyAccessToken(token, {
        audience: h.RESOURCE,
        issuer: 'https://evil.example.com',
        keys: await keys(),
      }),
    ).rejects.toBeInstanceOf(AccessTokenError);
    const { privateKey } = await generateKeyPair('ES256');
    const forged = await new SignJWT({
      client_id: h.CLIENT_ID,
      scope: 'spaces:read',
    })
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject(h.PERSON)
      .setIssuer(h.ISSUER)
      .setAudience(h.RESOURCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const err = await verifyAccessToken(forged, {
      audience: h.RESOURCE,
      issuer: h.ISSUER,
      keys: await keys(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AccessTokenError);
    expect(String(err.message)).not.toContain(forged);
  });

  it('rejects an unknown resource and a non-S256 challenge', async () => {
    const pkce = h.makePkce();
    let u = h.authorizeUrl(pkce, { resource: 'https://evil.example.com/mcp' });
    let res = await s.handler(h.req(u.pathname + u.search));
    expect(res.headers.get('location')).toContain('error=invalid_target');
    u = h.authorizeUrl(pkce, { code_challenge_method: 'plain' });
    res = await s.handler(h.req(u.pathname + u.search));
    expect(res.headers.get('location')).toContain('error=invalid_request');
  });

  it('refresh works with offline_access; the code is single use', async () => {
    const f = await h.fullFlow(s);
    const rt = f.token!.body.refresh_token as string;
    const r = await h.tokenRequest(s, {
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: h.CLIENT_ID,
      resource: h.RESOURCE,
    });
    expect(r.res.status).toBe(200);
    expect(decodeJwt(r.body.access_token).sub).toBe(h.PERSON);
    const code = f.cbUrl!.searchParams.get('code')!;
    const again = await h.tokenRequest(s, {
      grant_type: 'authorization_code',
      code,
      code_verifier: f.pkce.verifier,
      client_id: h.CLIENT_ID,
      redirect_uri: h.REDIRECT_URI,
      resource: h.RESOURCE,
    });
    expect(again.res.status).toBeGreaterThanOrEqual(400);
  });

  it('refresh does not depend on the AS browser session', async () => {
    const f = await h.fullFlow(s);
    await s.pool.query('delete from as_session');
    const r = await h.tokenRequest(s, {
      grant_type: 'refresh_token',
      refresh_token: f.token!.body.refresh_token,
      client_id: h.CLIENT_ID,
      resource: h.RESOURCE,
    });
    console.log(
      'INFO refresh after session deleted ->',
      r.res.status,
      JSON.stringify(r.body).slice(0, 120),
    );
    expect(r.res.status).toBe(200);
  });

  it('offline_access is added when the app did not ask for it, so a refresh token is issued', async () => {
    const f = await h.fullFlow(s, { scope: 'spaces:read' });
    expect(f.stage).toBe('done');
    expect(f.token!.body.refresh_token).toBeTruthy();
    expect(String(f.token!.body.scope).split(' ')).toContain('offline_access');
  });

  it('whitelist: a person not on the list cannot log in', async () => {
    const f = await h.fullFlow(s, { person: h.OTHER_PERSON });
    expect(f.stage).toBe('login');
    expect(f.login!.res.status).toBe(403);
  });

  it('whitelist re-check at refresh: a removed person cannot refresh', async () => {
    const f = await h.fullFlow(s);
    const rt = f.token!.body.refresh_token as string;
    const s2 = await h.makeServer(OTHER);
    try {
      const r = await h.tokenRequest(s2, {
        grant_type: 'refresh_token',
        refresh_token: rt,
        client_id: h.CLIENT_ID,
        resource: h.RESOURCE,
      });
      expect(r.res.status).toBe(403);
      expect(r.body.access_token).toBeUndefined();
    } finally {
      await s2.pool.end();
    }
  });

  it('whitelist at consent: an existing session of a removed person is blocked at authorize', async () => {
    const f = await h.fullFlow(s);
    const s2 = await h.makeServer(OTHER);
    try {
      const u = h.authorizeUrl(h.makePkce());
      const res = await s2.handler(
        h.req(u.pathname + u.search, { jar: f.jar }),
      );
      expect(res.status).toBe(403);
    } finally {
      await s2.pool.end();
    }
  });

  it('revocation: listing and deleting consent by person stops refresh', async () => {
    const f = await h.fullFlow(s);
    const apps = await listConnectedApps(s.pool, h.PERSON);
    expect(apps.map((a) => a.clientId)).toContain(h.CLIENT_ID);
    expect(apps.find((a) => a.clientId === h.CLIENT_ID)?.name).toBe(
      'Test AI App',
    );
    const rt = f.token!.body.refresh_token as string;
    // The library's own consent delete is not enough: INFO only
    const headers = new Headers({
      cookie: f.jar.header(),
      host: new URL(h.ISSUER).host,
    });
    const consents = await s.auth.api.getOAuthConsents({ headers });
    expect(
      consents.every((c: { userId?: string | null }) => c.userId === h.PERSON),
    ).toBe(true);
    await disconnectApp(s.pool, h.PERSON, h.CLIENT_ID);
    expect(await listConnectedApps(s.pool, h.PERSON)).toEqual([]);
    const after = await h.tokenRequest(s, {
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: h.CLIENT_ID,
      resource: h.RESOURCE,
    });
    console.log(
      'INFO refresh after consent delete ->',
      after.res.status,
      JSON.stringify(after.body).slice(0, 200),
    );
    expect(after.res.status).toBeGreaterThanOrEqual(400);
    expect(after.body.access_token).toBeUndefined();
  });

  it('storage: as_user.id is tied to people.sub (no second identity store)', async () => {
    await expect(
      s.pool.query(
        `insert into as_user (id, name, email, "emailVerified") values ('did:privy:nobody','x','nobody@example.org', false)`,
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await s.pool.query(
      `insert into people (sub, name, email) values ('did:privy:tmp','t','tmp@example.org')`,
    );
    await s.pool.query(
      `insert into as_user (id, name, email, "emailVerified") values ('did:privy:tmp','t','tmp@example.org', false)`,
    );
    await s.pool.query(`delete from people where sub = 'did:privy:tmp'`);
    const { rows } = await s.pool.query(
      `select 1 from as_user where id = 'did:privy:tmp'`,
    );
    expect(rows.length).toBe(0);
  });

  it('a whitelisted person without a Hypha profile cannot sign in', async () => {
    const s2 = await h.makeServer({
      AUTH_SERVER_SECRET: SECRET,
      AUTH_SERVER_ALLOWED_PERSON_IDS: 'did:privy:noprofile',
    });
    try {
      const f = await h.fullFlow(s2, { person: 'did:privy:noprofile' });
      expect(f.stage).toBe('login');
      expect(f.login!.res.status).toBe(403);
    } finally {
      await s2.pool.end();
    }
  });

  it('cookie: first-party, host-only, HttpOnly, SameSite=Lax, prefixed (coexistence, popup)', async () => {
    const pkce = h.makePkce();
    const u = h.authorizeUrl(pkce);
    const a = await s.handler(h.req(u.pathname + u.search));
    const q = new URL(a.headers.get('location')!, h.ISSUER).search.slice(1);
    const res = await s.handler(
      h.req('/api/auth/privy/sign-in', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          origin: h.ISSUER,
        },
        body: JSON.stringify({ privyToken: `ok:${h.PERSON}`, oauth_query: q }),
      }),
    );
    const cookies = res.headers.getSetCookie();
    console.log(
      'INFO cookie attrs:',
      cookies.map((c) => c.replace(/=[^;]+/, '=<v>')).join(' | '),
    );
    expect(cookies.length).toBeGreaterThan(0);
    for (const c of cookies) {
      expect(c).toMatch(/^hypha_as/);
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=Lax/i);
      expect(c).not.toMatch(/Domain=/i);
      expect(c).not.toMatch(/SameSite=None/i);
    }
  });

  it('the Privy token is never stored or returned', async () => {
    const f = await h.fullFlow(s);
    const dump =
      JSON.stringify((await s.pool.query('select * from as_session')).rows) +
      JSON.stringify((await s.pool.query('select * from as_account')).rows) +
      JSON.stringify(
        (await s.pool.query('select * from as_verification')).rows,
      ) +
      JSON.stringify(f.token) +
      JSON.stringify(f.login?.body);
    expect(dump).not.toContain('ok:did:privy');
  });
});

run('authorization server: host block, surface, kill switch, redaction', () => {
  let s: h.Harness;
  beforeAll(async () => {
    s = await h.makeServer({ AUTH_SERVER_SECRET: SECRET });
    await h.seedPeople(s.pool, [h.PERSON]);
  });
  afterAll(async () => {
    await s.pool.end();
  });
  const handle = () =>
    createAuthServerHandler(
      () => s.config,
      () => s,
    );
  const onHost = (host: string, path: string, init: RequestInit = {}) =>
    new Request(`${h.ISSUER}${path}`, {
      ...init,
      headers: { host, ...(init.headers as object) },
    });

  it('answers on the issuer host; 404 on any other host', async () => {
    const ok = await handle()(onHost('auth.localhost:3000', '/api/auth/jwks'));
    expect(ok.status).toBe(200);
    for (const host of [
      'localhost:3000',
      'app.hypha.earth',
      'auth.localhost:3001',
      'evil.com',
    ]) {
      for (const path of [
        '/api/auth/jwks',
        '/api/auth/oauth2/token',
        '/.well-known/oauth-authorization-server',
        '/api/auth/privy/sign-in',
      ]) {
        const method =
          path.includes('token') || path.includes('sign-in') ? 'POST' : 'GET';
        const res = await handle()(onHost(host, path, { method }));
        expect(res.status, `${host}${path}`).toBe(404);
      }
    }
  });

  it('metadata and JWKS resolve under the issuer; metadata is path-less and points at the AS-only JWKS', async () => {
    const res = await handle()(
      onHost('auth.localhost:3000', '/.well-known/oauth-authorization-server'),
    );
    expect(res.status).toBe(200);
    const meta = await res.json();
    expect(meta.issuer).toBe(h.ISSUER);
    expect(meta.jwks_uri).toBe(`${h.ISSUER}/api/auth/jwks`);
    expect(meta.code_challenge_methods_supported).toEqual(['S256']);
    expect(meta.client_id_metadata_document_supported).toBe(true);
    expect(meta.authorization_response_iss_parameter_supported).toBe(true);
    expect(meta.registration_endpoint).toBeUndefined();
  });

  it('library endpoints outside the allowlist are not reachable', async () => {
    for (const [p, m] of [
      ['/api/auth/oauth2/create-client', 'POST'],
      ['/api/auth/oauth2/get-clients', 'GET'],
      ['/api/auth/oauth2/register', 'POST'],
      ['/api/auth/oauth2/introspect', 'POST'],
      ['/api/auth/oauth2/userinfo', 'GET'],
      ['/api/auth/sign-up/email', 'POST'],
      ['/api/auth/get-session', 'GET'],
      ['/api/auth/list-sessions', 'GET'],
      ['/api/auth/token', 'GET'],
      ['/api/auth/ok', 'GET'],
    ] as const) {
      const res = await handle()(
        onHost('auth.localhost:3000', p, { method: m }),
      );
      expect(res.status, p).toBe(404);
    }
  });

  it('kill switch and production-only', async () => {
    const base = {
      AUTH_SERVER_ISSUER: h.ISSUER,
      AUTH_SERVER_SECRET: SECRET,
      DEFAULT_DB_URL: 'postgresql://x@localhost/x',
      NEXT_PUBLIC_PRIVY_APP_ID: 'a',
    };
    const on = { ...base, AUTH_SERVER_ENABLED: 'true' };
    expect(loadAuthServerConfig({ ...base }).enabled).toBe(false);
    expect(
      loadAuthServerConfig({ ...base, AUTH_SERVER_ENABLED: 'false' }).enabled,
    ).toBe(false);
    expect(
      loadAuthServerConfig({ ...base, AUTH_SERVER_ENABLED: '1' }).enabled,
    ).toBe(false);
    expect(loadAuthServerConfig(on).enabled).toBe(true);
    expect(loadAuthServerConfig({ ...on, VERCEL_ENV: 'preview' }).enabled).toBe(
      false,
    );
    expect(
      loadAuthServerConfig({ ...on, VERCEL_ENV: 'development' }).enabled,
    ).toBe(false);
    expect(
      loadAuthServerConfig({ ...on, VERCEL_ENV: 'production' }).enabled,
    ).toBe(true);
    expect(
      loadAuthServerConfig({
        ...on,
        AUTH_SERVER_ISSUER: 'https://auth.example.org/auth',
      }).enabled,
    ).toBe(false);
    expect(
      loadAuthServerConfig({
        ...on,
        AUTH_SERVER_ISSUER: 'http://auth.example.org',
      }).enabled,
    ).toBe(false);
    expect(
      loadAuthServerConfig({ ...on, AUTH_SERVER_SECRET: 'short' }).enabled,
    ).toBe(false);
    // The dev-only Privy key override is honoured only for a localhost issuer outside production.
    const dev = {
      ...on,
      AUTH_SERVER_DEV_PRIVY_JWKS_URL: 'http://127.0.0.1:4010/jwks',
    };
    expect(
      (loadAuthServerConfig(dev) as { privyJwksUrlOverride?: string })
        .privyJwksUrlOverride,
    ).toBeDefined();
    expect(
      (
        loadAuthServerConfig({ ...dev, NODE_ENV: 'production' }) as {
          privyJwksUrlOverride?: string;
        }
      ).privyJwksUrlOverride,
    ).toBeUndefined();
    expect(
      (
        loadAuthServerConfig({
          ...dev,
          AUTH_SERVER_ISSUER: 'https://auth.example.org',
        }) as { privyJwksUrlOverride?: string }
      ).privyJwksUrlOverride,
    ).toBeUndefined();
    const off = createAuthServerHandler(
      () => ({ enabled: false, reason: 'x' }),
      () => {
        throw new Error('must not be built');
      },
    );
    expect(
      (await off(onHost('auth.localhost:3000', '/api/auth/jwks'))).status,
    ).toBe(404);
  });

  it('empty whitelist allows nobody', () => {
    expect(isPersonAllowed({ allowedPersonIds: new Set() }, h.PERSON)).toBe(
      false,
    );
    expect(
      isPersonAllowed({ allowedPersonIds: new Set([h.PERSON]) }, h.PERSON),
    ).toBe(true);
    expect(
      isPersonAllowed({ allowedPersonIds: new Set([h.PERSON]) }, undefined),
    ).toBe(false);
  });

  it('redaction: tokens, codes and secrets never reach logs or error responses', async () => {
    const jwt =
      'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4eHh4eHh4In0.c2lnbmF0dXJlc2lnbmF0dXJl';
    const out = redactSecrets(
      `failed access_token=${jwt} Bearer abcdefghijklmnop code=SECRETCODE12345 client_secret: topsecretvalue`,
    );
    expect(out).not.toContain(jwt);
    expect(out).not.toContain('abcdefghijklmnop');
    expect(out).not.toContain('SECRETCODE12345');
    expect(out).not.toContain('topsecretvalue');

    // End to end: a verifier that throws with the token in its message; response and every log line stay clean.
    const spies = [
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'log'),
    ];
    spies.forEach((sp) => sp.mockImplementation(() => {}));
    const leaky = await h.makeServer(
      { AUTH_SERVER_SECRET: SECRET },
      {
        verifyPrivyToken: async (t) => {
          throw new Error(`boom for token ${t}`);
        },
      },
    );
    try {
      const secretToken = `eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJkaWQ6cHJpdnk6YWxsb3dlZDEifQ.${'s'.repeat(
        40,
      )}`;
      const hh = createAuthServerHandler(
        () => leaky.config,
        () => leaky,
      );
      const res = await hh(
        onHost('auth.localhost:3000', '/api/auth/privy/sign-in', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: h.ISSUER },
          body: JSON.stringify({ privyToken: secretToken }),
        }),
      );
      const body = await res.text();
      const logged = spies
        .flatMap((sp) => sp.mock.calls)
        .flat()
        .map(String)
        .join('\n');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body).not.toContain(secretToken);
      expect(logged).not.toContain(secretToken);
      expect(logged).not.toContain('s'.repeat(40));
    } finally {
      spies.forEach((sp) => sp.mockRestore());
      await leaky.pool.end();
    }
  });
});
