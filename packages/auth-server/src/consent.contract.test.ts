import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decodeJwt } from 'jose';
import * as h from './testing/harness';
import { createAuthServerHandler } from './handler';
import { classifyClient, loadConsentRequest } from './consent';
import { resetRegistrationLimiter } from './registration';

const run = h.TEST_DB_URL ? describe : describe.skip;
const MCP = 'http://localhost:4000/mcp';
const CB = 'http://127.0.0.1:33418/callback';
const ALL = 'spaces:read agreements:vote offline_access';
const TIER_A = 'tier-a-app';
const TIER_A_CB = 'https://tier-a.example.com/callback';

run(
  'consent: write scope is a choice, and the grant is exactly what was ticked',
  () => {
    let s: h.Harness;
    let handle: (r: Request) => Promise<Response>;
    beforeAll(async () => {
      s = await h.makeServer({
        AUTH_SERVER_SECRET: 'contract-test-secret-'.padEnd(48, 'x'),
        AUTH_SERVER_RESOURCES: `${h.RESOURCE},${MCP}`,
        AUTH_SERVER_DCR_ENABLED: 'true',
      });
      await h.resetAsTables(s.pool);
      await h.seedPeople(s.pool, [h.PERSON]);
      await s.pool.query(
        `insert into as_oauth_client (id, "clientId", name, "redirectUris", scopes, "tokenEndpointAuthMethod",
         "grantTypes", "responseTypes", "requirePKCE", "skipConsent", "createdAt", "updatedAt")
       values ('ta1', $1, 'Tier A App', $2::jsonb, $3::jsonb, 'none',
         '["authorization_code","refresh_token"]', '["code"]', true, false, now(), now())`,
        [
          TIER_A,
          JSON.stringify([TIER_A_CB]),
          JSON.stringify(['spaces:read', 'agreements:vote', 'offline_access']),
        ],
      );
      handle = createAuthServerHandler(
        () => s.config,
        () => s,
      );
    });
    afterAll(async () => {
      await s.pool.end();
    });
    beforeEach(() => resetRegistrationLimiter());

    const register = async () => {
      const res = await handle(
        h.req('/api/auth/oauth2/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_name: 'MCP Host',
            redirect_uris: [CB],
            scope: ALL,
          }),
        }),
      );
      expect(res.status).toBe(201);
      return (await res.json()).client_id as string;
    };

    type Flow = Awaited<ReturnType<typeof toConsent>>;

    /** authorize + sign in; returns the consent query and the signed-in jar. */
    const toConsent = async (
      clientId: string,
      redirect: string,
      scope = ALL,
      resource = MCP,
      jar = new h.CookieJar(),
    ) => {
      const pkce = h.makePkce();
      const u = h.authorizeUrl(pkce, {
        client_id: clientId,
        redirect_uri: redirect,
        scope,
        resource,
      });
      const a = await s.handler(h.req(u.pathname + u.search, { jar }));
      const loc = new URL(a.headers.get('location')!, h.ISSUER);
      const login = await h.signIn(s, jar, loc.search.slice(1));
      const next = new URL(login.body.url, h.ISSUER);
      return { pkce, jar, next, redirect, clientId, resource };
    };

    const view = async (f: Flow) => {
      const request = await loadConsentRequest(
        s,
        new Headers({ cookie: f.jar.header() }),
        f.next.search,
      );
      expect(request).not.toBeNull();
      return request!;
    };

    const exchange = (f: Flow, code: string) =>
      h.tokenRequest(s, {
        grant_type: 'authorization_code',
        code,
        code_verifier: f.pkce.verifier,
        client_id: f.clientId,
        redirect_uri: f.redirect,
        resource: f.resource,
      });

    it('classifies the three ways a client can be identified', () => {
      expect(classifyClient('abc123', 'dcr')).toBe('dcr');
      expect(classifyClient('https://claude.ai/x.json', null)).toBe('cimd');
      expect(classifyClient('tier-a-app', null)).toBe('registered');
    });

    it('pre-registered: every requested scope starts ticked, no warning', async () => {
      const f = await toConsent(TIER_A, TIER_A_CB);
      const v = await view(f);
      expect(v.client.kind).toBe('registered');
      expect(v.scopes.map((x) => [x.scope, x.defaultGranted])).toEqual([
        ['spaces:read', true],
        ['agreements:vote', true],
        ['offline_access', true],
      ]);
      expect(v.scopes.every((x) => x.warning === undefined)).toBe(true);
    });

    it('dynamically registered: write scope unticked with a warning; read and offline_access ticked', async () => {
      const id = await register();
      const v = await view(await toConsent(id, CB));
      expect(v.client.kind).toBe('dcr');
      const by = Object.fromEntries(v.scopes.map((x) => [x.scope, x]));
      expect(by['spaces:read']!.defaultGranted).toBe(true);
      expect(by['offline_access']!.defaultGranted).toBe(true);
      expect(by['agreements:vote']!.defaultGranted).toBe(false);
      expect(by['agreements:vote']!.warning).toMatch(/not approved/);
      expect(by['spaces:read']!.warning).toBeUndefined();
    });

    it('CIMD client: same defaults as DCR', async () => {
      const f = await toConsent(h.CLIENT_ID, h.REDIRECT_URI, ALL, h.RESOURCE);
      const v = await view(f);
      expect(v.client.kind).toBe('cimd');
      expect(v.scopes.find((x) => x.scope === 'agreements:vote')).toMatchObject(
        {
          defaultGranted: false,
        },
      );
    });

    it('what is ticked is what is granted: token and refresh carry no write scope, and refresh cannot widen it', async () => {
      const id = await register();
      const f = await toConsent(id, CB);
      const c = await h.consent(
        s,
        f.jar,
        f.next.search.slice(1),
        'spaces:read offline_access',
      );
      const t = await exchange(
        f,
        new URL(c.body.url).searchParams.get('code')!,
      );
      expect(t.res.status).toBe(200);
      expect(t.body.scope.split(' ').sort()).toEqual([
        'offline_access',
        'spaces:read',
      ]);
      expect(String(decodeJwt(t.body.access_token).scope)).not.toContain(
        'agreements:vote',
      );
      const widen = await h.tokenRequest(s, {
        grant_type: 'refresh_token',
        refresh_token: t.body.refresh_token,
        client_id: id,
        scope: 'spaces:read agreements:vote',
        resource: MCP,
      });
      expect(widen.res.status).toBe(400);
      const plain = await h.tokenRequest(s, {
        grant_type: 'refresh_token',
        refresh_token: t.body.refresh_token,
        client_id: id,
        resource: MCP,
      });
      expect(plain.res.status).toBe(200);
      expect(String(plain.body.scope)).not.toContain('agreements:vote');
      expect(String(decodeJwt(plain.body.access_token).scope)).not.toContain(
        'agreements:vote',
      );
    });

    it('the person can tick it: the grant then includes it, token and refresh', async () => {
      const id = await register();
      const f = await toConsent(id, CB);
      const c = await h.consent(s, f.jar, f.next.search.slice(1), ALL);
      const t = await exchange(
        f,
        new URL(c.body.url).searchParams.get('code')!,
      );
      expect(t.res.status).toBe(200);
      expect(t.body.scope).toContain('agreements:vote');
      const r = await h.tokenRequest(s, {
        grant_type: 'refresh_token',
        refresh_token: t.body.refresh_token,
        client_id: id,
        resource: MCP,
      });
      expect(r.res.status).toBe(200);
      expect(r.body.scope).toContain('agreements:vote');
    });

    it('asking again for the write scope after a read-only grant shows consent again', async () => {
      const id = await register();
      const f = await toConsent(id, CB);
      const c = await h.consent(
        s,
        f.jar,
        f.next.search.slice(1),
        'spaces:read offline_access',
      );
      expect(c.res.status).toBe(200);
      const again = await toConsent(id, CB, ALL, MCP, f.jar);
      expect(again.next.pathname).toBe('/auth/consent');
    });

    it('approving without an explicit scope is refused (the library would grant everything requested)', async () => {
      const id = await register();
      const f = await toConsent(id, CB);
      const res = await s.handler(
        h.req('/api/auth/oauth2/consent', {
          method: 'POST',
          jar: f.jar,
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            origin: h.ISSUER,
          },
          body: JSON.stringify({
            accept: true,
            oauth_query: f.next.search.slice(1),
          }),
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_request');
    });

    it('identity: CIMD offers its proven host; DCR offers no host and never exposes logo or policy links', async () => {
      const cimd = await view(
        await toConsent(h.CLIENT_ID, h.REDIRECT_URI, ALL, h.RESOURCE),
      );
      expect(cimd.client.host).toBe('client.example.com');

      const res = await handle(
        h.req('/api/auth/oauth2/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Claimed Name',
            client_uri: 'https://claimed.example.com',
            logo_uri: 'https://claimed.example.com/logo.png',
            tos_uri: 'https://claimed.example.com/tos',
            policy_uri: 'https://claimed.example.com/policy',
            redirect_uris: [CB],
            scope: ALL,
          }),
        }),
      );
      const id = (await res.json()).client_id as string;
      const v = await view(await toConsent(id, CB));
      expect(v.client.kind).toBe('dcr');
      expect(v.client.name).toBe('Claimed Name');
      expect(v.client.host).toBe('');
      const wire = JSON.stringify(v);
      expect(wire).not.toContain('logo');
      expect(wire).not.toContain('/tos');
      expect(wire).not.toContain('/policy');
    });
  },
);
