import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createLocalJWKSet, decodeJwt } from 'jose';
import * as h from '../testing/harness';
import { verifyAccessToken } from '../verify';
import { loadConsentRequest } from '../consent';
import { SPACE_GRANTS_CLAIM } from '../grants';
import { CLIENT_NAME_CLAIM } from '../client-name';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'signals-write-contract-secret-'.padEnd(48, 'x');
const MCP = 'http://localhost:4000/mcp';
const RESOURCES = `${h.RESOURCE},${MCP}`;
// A registered (pre-approved) client whose row allows every scope, so the flow is limited only by
// the resource's channel list and the consent rules under test.
const APP = 'signals-writer-app';
const APP_CB = 'https://writer.example.com/callback';
const APP_NAME = 'Writer App';

run(
  'signals:write: offered and issued only on the MCP channel while MCP writes are on',
  () => {
    let on: h.Harness;
    let space: number;

    const resourceRow = async (pool: h.Harness['pool'], identifier: string) =>
      (
        await pool.query(
          'select "allowedScopes" from as_oauth_resource where identifier = $1',
          [identifier],
        )
      ).rows[0]?.allowedScopes as string[] | null | undefined;

    beforeAll(async () => {
      on = await h.makeServer({
        AUTH_SERVER_SECRET: SECRET,
        AUTH_SERVER_RESOURCES: RESOURCES,
        MCP_WRITES_ENABLED: 'true',
      });
      await h.resetAsTables(on.pool);
      await h.seedPeople(on.pool, [h.PERSON]);
      await on.pool.query(
        `insert into as_oauth_client (id, "clientId", name, "redirectUris", scopes, "tokenEndpointAuthMethod",
         "grantTypes", "responseTypes", "requirePKCE", "skipConsent", "createdAt", "updatedAt", metadata)
       values ('sw1', $1, $2, $3::jsonb, $4::jsonb, 'none',
         '["authorization_code","refresh_token"]', '["code"]', true, false, now(), now(),
         '{"registration":"registered"}'::jsonb)`,
        [
          APP,
          APP_NAME,
          JSON.stringify([APP_CB]),
          JSON.stringify([
            'spaces:read',
            'agreements:vote',
            'signals:write',
            'offline_access',
          ]),
        ],
      );
      const { rows } = await on.pool.query(
        `insert into spaces (title, slug) values ('signals-write-space', 'signals-write-space')
       on conflict (slug) do update set title = excluded.title returning id`,
      );
      space = rows[0].id;
    });
    afterAll(async () => {
      await on.pool.end();
    });
    beforeEach(async () => {
      await on.pool.query('delete from as_oauth_consent');
      await on.pool.query('delete from as_client_grant');
    });

    /** authorize + sign in; returns what the consent page needs. */
    const toConsent = async (s: h.Harness, scope: string, resource = MCP) => {
      const pkce = h.makePkce();
      const jar = new h.CookieJar();
      const u = h.authorizeUrl(pkce, {
        client_id: APP,
        redirect_uri: APP_CB,
        scope,
        resource,
      });
      const a = await s.handler(h.req(u.pathname + u.search, { jar }));
      const loc = new URL(a.headers.get('location')!, h.ISSUER);
      const login = await h.signIn(s, jar, loc.search.slice(1));
      const next = new URL(login.body.url, h.ISSUER);
      return { pkce, jar, next, resource };
    };

    const view = async (
      s: h.Harness,
      f: Awaited<ReturnType<typeof toConsent>>,
    ) =>
      (await loadConsentRequest(
        s,
        new Headers({ cookie: f.jar.header() }),
        f.next.search,
      ))!;

    /** The whole flow up to the token, approving exactly `approve`. */
    const connect = async (
      s: h.Harness,
      ask: string,
      approve: string,
      resource = MCP,
    ) => {
      const f = await toConsent(s, ask, resource);
      const c = await h.consent(
        s,
        f.jar,
        f.next.search.slice(1),
        approve,
        h.PERSON,
        [space],
      );
      if (!c.body?.url) return { consent: c, token: undefined };
      const token = await h.tokenRequest(s, {
        grant_type: 'authorization_code',
        code: new URL(c.body.url).searchParams.get('code')!,
        code_verifier: f.pkce.verifier,
        client_id: APP,
        redirect_uri: APP_CB,
        resource,
      });
      return { consent: c, token };
    };

    it('the MCP resource row lists signals:write while writes are on; the API row never does', async () => {
      // Any request seeds the declared resources for this instance.
      await on.handler(h.req('/.well-known/oauth-authorization-server'));
      await toConsent(on, 'spaces:read');
      expect(await resourceRow(on.pool, MCP)).toEqual([
        'spaces:read',
        'offline_access',
        'signals:write',
      ]);
      expect(await resourceRow(on.pool, h.RESOURCE)).toEqual([
        'spaces:read',
        'agreements:vote',
        'offline_access',
      ]);
    });

    it('the consent page offers signals:write unticked even for a pre-approved client, without the unapproved warning', async () => {
      const v = await view(
        on,
        await toConsent(on, 'spaces:read signals:write'),
      );
      expect(v.client.kind).toBe('registered');
      const by = Object.fromEntries(v.scopes.map((x) => [x.scope, x]));
      expect(by['signals:write']).toMatchObject({
        copyKey: 'signalsWrite',
        defaultGranted: false,
        warn: false,
      });
      expect(by['spaces:read']!.defaultGranted).toBe(true);
    });

    it('asking for signals:write alone also asks for spaces:read, so the space picker shows', async () => {
      const v = await view(on, await toConsent(on, 'signals:write'));
      expect(v.scopes.map((x) => x.scope).sort()).toEqual([
        'offline_access',
        'signals:write',
        'spaces:read',
      ]);
    });

    it('an approval of signals:write without spaces:read is refused and nothing is stored', async () => {
      const r = await connect(on, 'spaces:read signals:write', 'signals:write');
      expect(r.consent.res.status).toBe(400);
      expect(r.consent.body.error).toBe('invalid_request');
      const { rows } = await on.pool.query(
        'select count(*)::int as n from as_client_grant',
      );
      expect(rows[0].n).toBe(0);
    });

    it('approved with spaces:read: the token carries the scope, the chosen spaces and the client name', async () => {
      const r = await connect(
        on,
        'spaces:read signals:write',
        'spaces:read signals:write offline_access',
      );
      expect(r.token!.res.status).toBe(200);
      const claims = decodeJwt(r.token!.body.access_token);
      expect(String(claims.scope).split(' ').sort()).toEqual([
        'offline_access',
        'signals:write',
        'spaces:read',
      ]);
      expect(claims[SPACE_GRANTS_CLAIM]).toEqual([space]);
      expect(claims[CLIENT_NAME_CLAIM]).toBe(APP_NAME);
      const keys = createLocalJWKSet(
        await (await on.handler(h.req('/api/auth/jwks.json'))).json(),
      );
      const verified = await verifyAccessToken(r.token!.body.access_token, {
        audience: MCP,
        issuer: h.ISSUER,
        keys,
      });
      expect(verified.clientName).toBe(APP_NAME);
      expect(verified.scopes).toContain('signals:write');
      // The grant is the same read-level grant as before: no new level, no new table.
      const { rows } = await on.pool.query(
        'select level from as_client_grant where "userId" = $1 and "clientId" = $2',
        [h.PERSON, APP],
      );
      expect(rows).toEqual([{ level: 'read' }]);
    });

    it('the API channel never issues signals:write', async () => {
      const r = await connect(
        on,
        'spaces:read signals:write',
        'spaces:read signals:write offline_access',
        h.RESOURCE,
      );
      expect(r.token!.res.status).toBe(200);
      expect(String(decodeJwt(r.token!.body.access_token).scope)).not.toContain(
        'signals:write',
      );
    });

    it('switching writes off: not offered, not issued, and the next refresh drops it', async () => {
      const r = await connect(
        on,
        'spaces:read signals:write',
        'spaces:read signals:write offline_access',
      );
      const rt = r.token!.body.refresh_token as string;
      expect(rt).toBeTruthy();

      // A new instance with the switch off re-declares the MCP row (merge mode).
      const off = await h.makeServer({
        AUTH_SERVER_SECRET: SECRET,
        AUTH_SERVER_RESOURCES: RESOURCES,
      });
      try {
        const refreshed = await h.tokenRequest(off, {
          grant_type: 'refresh_token',
          refresh_token: rt,
          client_id: APP,
          resource: MCP,
        });
        expect(refreshed.res.status).toBe(200);
        expect(
          String(decodeJwt(refreshed.body.access_token).scope)
            .split(' ')
            .sort(),
        ).toEqual(['offline_access', 'spaces:read']);
        expect(await resourceRow(off.pool, MCP)).toEqual([
          'spaces:read',
          'offline_access',
        ]);

        await off.pool.query('delete from as_oauth_consent');
        const v = await view(
          off,
          await toConsent(off, 'spaces:read signals:write'),
        );
        expect(v.scopes.map((x) => x.scope)).not.toContain('signals:write');

        // Approving it anyway (a crafted request) does not put it in the token.
        await off.pool.query('delete from as_oauth_consent');
        const crafted = await connect(
          off,
          'spaces:read signals:write',
          'spaces:read signals:write offline_access',
        );
        expect(crafted.token!.res.status).toBe(200);
        expect(
          String(decodeJwt(crafted.token!.body.access_token).scope),
        ).not.toContain('signals:write');
      } finally {
        await off.pool.end();
      }
    });
  },
);
