import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decodeJwt } from 'jose';
import * as h from './testing/harness';
import { createAuthServerHandler } from './handler';
import {
  REGISTRATION_GLOBAL_PER_HOUR,
  REGISTRATION_MAX_BODY_BYTES,
  REGISTRATION_PER_IP_PER_HOUR,
  purgeUnusedRegisteredClients,
  resetRegistrationLimiter,
} from './registration';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'contract-test-secret-'.padEnd(48, 'x');
const MCP = 'http://localhost:4000/mcp';
const CB = 'http://127.0.0.1:33418/callback';

run('dynamic client registration (experiment): limits and flow', () => {
  let s: h.Harness;
  let handle: (r: Request) => Promise<Response>;
  beforeAll(async () => {
    s = await h.makeServer({
      AUTH_SERVER_SECRET: SECRET,
      AUTH_SERVER_RESOURCES: `${h.RESOURCE},${MCP}`,
    });
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON]);
    handle = createAuthServerHandler(
      () => s.config,
      () => s,
    );
  });
  afterAll(async () => {
    await s.pool.end();
  });
  beforeEach(() => resetRegistrationLimiter());

  const register = (body: unknown, headers: Record<string, string> = {}) =>
    handle(
      h.req('/api/auth/oauth2/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  const ok = { client_name: 'MCP Host', redirect_uris: [CB] };

  it('registers a public client: no secret, fixed grants, default scope', async () => {
    const res = await register({
      ...ok,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toBeTruthy();
    expect(body.client_secret).toBeUndefined();
    expect(body.token_endpoint_auth_method).toBe('none');
    expect(body.grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(body.scope.split(' ').sort()).toEqual([
      'offline_access',
      'spaces:read',
    ]);
    const { rows } = await s.pool.query(
      'select scopes, "skipConsent", metadata from as_oauth_client where "clientId"=$1',
      [body.client_id],
    );
    expect(rows[0].scopes).toEqual(['spaces:read', 'offline_access']);
    expect(rows[0].skipConsent).toBe(false);
    expect(rows[0].metadata).toEqual({ registration: 'dcr' });
  });

  it('works from another origin and ignores a session cookie (never owned, clientPrivileges not consulted)', async () => {
    const res = await register(ok, {
      origin: 'http://localhost:6274',
      cookie: 'hypha_as.session_token=whatever',
    });
    expect(res.status).toBe(201);
    const { rows } = await s.pool.query(
      'select "userId" from as_oauth_client where "clientId"=$1',
      [(await res.json()).client_id],
    );
    expect(rows[0].userId).toBeNull();
  });

  it('refuses anything outside the profile', async () => {
    const bad: Array<[string, unknown]> = [
      [
        'confidential',
        { ...ok, token_endpoint_auth_method: 'client_secret_basic' },
      ],
      ['client_credentials', { ...ok, grant_types: ['client_credentials'] }],
      [
        'extra grant',
        { ...ok, grant_types: ['authorization_code', 'implicit'] },
      ],
      ['refresh only', { ...ok, grant_types: ['refresh_token'] }],
      ['token response', { ...ok, response_types: ['token'] }],
      ['no redirect', { client_name: 'x' }],
      ['custom scheme', { ...ok, redirect_uris: ['myapp://cb'] }],
      [
        'http non-loopback',
        { ...ok, redirect_uris: ['http://example.com/cb'] },
      ],
      ['fragment', { ...ok, redirect_uris: ['https://example.com/cb#x'] }],
      ['credentials', { ...ok, redirect_uris: ['https://u:p@example.com/cb'] }],
      [
        'localhost lookalike',
        { ...ok, redirect_uris: ['http://localhost.evil.com/cb'] },
      ],
      [
        'too many uris',
        { ...ok, redirect_uris: Array(6).fill('https://e.com/cb') },
      ],
      ['scope outside vocabulary', { ...ok, scope: 'spaces:read admin' }],
      ['not an object', '[]'],
      ['not json', '{nope'],
    ];
    for (const [name, body] of bad) {
      resetRegistrationLimiter(); // rejected attempts count against the per-address budget
      const res = await register(body);
      expect(res.status, name).toBe(400);
      const json = await res.json();
      expect(json.error, name).toMatch(
        /invalid_client_metadata|invalid_redirect_uri|invalid_scope/,
      );
    }
  });

  it('accepts https and every loopback form; ports are free', async () => {
    for (const uri of [
      'https://app.example.com/cb',
      'http://localhost:6274/oauth/callback',
      'http://127.0.0.1:1234/cb',
      'http://[::1]:1234/cb',
    ]) {
      const res = await register({ ...ok, redirect_uris: [uri] });
      expect(res.status, uri).toBe(201);
    }
  });

  it('drops resources, keys, logout and unknown fields; sanitises text and links', async () => {
    const res = await register({
      ...ok,
      client_name: `  <script>alert(1)</script>\u0000 Evil\n\tName  ${'z'.repeat(
        400,
      )}`,
      client_uri: 'javascript:alert(1)',
      logo_uri: 'http://insecure.example.com/l.png',
      tos_uri: 'https://example.com/tos',
      resources: ['https://evil.example.com'],
      jwks_uri: 'https://evil.example.com/jwks',
      backchannel_logout_uri: 'https://evil.example.com/out',
      contacts: ['a@b.c'],
      software_statement: 'abc',
      whatever: 1,
    });
    expect(res.status).toBe(201);
    const { rows } = await s.pool.query(
      'select name, uri, icon, tos, "jwksUri", "backchannelLogoutUri", contacts, "softwareStatement" from as_oauth_client where "clientId"=$1',
      [(await res.json()).client_id],
    );
    const r = rows[0];
    expect(r.name.length).toBeLessThanOrEqual(100);
    expect(r.name).not.toMatch(/[<>\u0000\n\t]/);
    expect(r.uri).toBeNull();
    expect(r.icon).toBeNull();
    expect(r.tos).toBe('https://example.com/tos');
    expect(r.jwksUri).toBeNull();
    expect(r.backchannelLogoutUri).toBeNull();
    expect(r.contacts).toBeNull();
    expect(r.softwareStatement).toBeNull();
  });

  it('caps the body, requires JSON, GET is not served', async () => {
    const big = await register({
      ...ok,
      client_name: 'x'.repeat(REGISTRATION_MAX_BODY_BYTES),
    });
    expect(big.status).toBe(413);
    const form = await handle(
      h.req('/api/auth/oauth2/register', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'a=b',
      }),
    );
    expect(form.status).toBe(415);
    const get = await handle(h.req('/api/auth/oauth2/register'));
    expect(get.status).toBe(404);
  });

  it('rate limits per address, and over the whole server per hour', async () => {
    const hdr = { 'x-real-ip': '203.0.113.9' };
    for (let i = 0; i < REGISTRATION_PER_IP_PER_HOUR; i++) {
      expect((await register(ok, hdr)).status).toBe(201);
    }
    const limited = await register(ok, hdr);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    resetRegistrationLimiter();
    await s.pool.query(
      `insert into as_oauth_client (id, "clientId", "redirectUris", metadata, "createdAt", "updatedAt")
       select 'g'||n, 'g'||n, '[]'::jsonb, '{"registration":"dcr"}'::jsonb, now(), now()
         from generate_series(1, $1::int) n on conflict do nothing`,
      [REGISTRATION_GLOBAL_PER_HOUR],
    );
    expect((await register(ok, { 'x-real-ip': '198.51.100.7' })).status).toBe(
      429,
    );
    await s.pool.query(
      `delete from as_oauth_client where "clientId" like 'g%'`,
    );
  });

  it('cleanup removes only old, unused registered clients', async () => {
    await s.pool.query(
      `insert into as_oauth_client (id, "clientId", "redirectUris", metadata, "createdAt", "updatedAt") values
        ('old1','old-dcr','[]','{"registration":"dcr"}', now() - interval '30 days', now()),
        ('new1','new-dcr','[]','{"registration":"dcr"}', now(), now()),
        ('man1','old-manual','[]',null, now() - interval '30 days', now())`,
    );
    await purgeUnusedRegisteredClients(s.pool);
    const { rows } = await s.pool.query(
      `select "clientId" from as_oauth_client where "clientId" in ('old-dcr','new-dcr','old-manual')`,
    );
    expect(rows.map((r) => r.clientId).sort()).toEqual([
      'new-dcr',
      'old-manual',
    ]);
  });

  it('full flow: registered client + resource http://localhost:4000/mcp gives a token whose aud is exactly that resource', async () => {
    const reg = await (await register({ ...ok, scope: 'spaces:read' })).json();
    const pkce = h.makePkce();
    const jar = new h.CookieJar();
    const redirect = 'http://127.0.0.1:55555/callback'; // other port: loopback ports are ignored
    const u = h.authorizeUrl(pkce, {
      client_id: reg.client_id,
      redirect_uri: redirect,
      scope: 'spaces:read',
      resource: MCP,
    });
    const a = await s.handler(h.req(u.pathname + u.search));
    const login = await h.signIn(
      s,
      jar,
      new URL(a.headers.get('location')!, h.ISSUER).search.slice(1),
    );
    expect(login.res.status).toBe(200);
    const next = new URL(login.body.url, h.ISSUER);
    // consent is always shown for a registered client
    expect(next.pathname).toBe('/auth/consent');
    const c = await h.consent(
      s,
      jar,
      next.search.slice(1),
      'spaces:read offline_access',
    );
    const cb = new URL(c.body.url);
    const t = await h.tokenRequest(s, {
      grant_type: 'authorization_code',
      code: cb.searchParams.get('code')!,
      code_verifier: pkce.verifier,
      client_id: reg.client_id,
      redirect_uri: redirect,
      resource: MCP,
    });
    expect(t.res.status).toBe(200);
    const claims = decodeJwt(t.body.access_token);
    expect(claims.aud).toBe(MCP);
    expect(claims.client_id).toBe(reg.client_id);
    expect(t.body.refresh_token).toBeTruthy();
  });

  it('a registered client cannot obtain a scope it was not registered with', async () => {
    const reg = await (await register({ ...ok, scope: 'spaces:read' })).json();
    const u = h.authorizeUrl(h.makePkce(), {
      client_id: reg.client_id,
      redirect_uri: CB,
      scope: 'spaces:read agreements:vote',
      resource: MCP,
    });
    const res = await s.handler(h.req(u.pathname + u.search));
    expect(res.headers.get('location')).toContain('error=invalid_scope');
  });
});
