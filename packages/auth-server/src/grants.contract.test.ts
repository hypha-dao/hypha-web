import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createLocalJWKSet, decodeJwt } from 'jose';
import * as h from './testing/harness';
import { verifyAccessToken } from './verify';
import { disconnectApp } from './connected-apps';
import { readGrant, SPACE_GRANTS_CLAIM, MAX_SPACE_GRANTS } from './grants';
import { loadConsentRequest } from './consent';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'grants-contract-secret-'.padEnd(48, 'x');
const MCP = 'http://localhost:4000/mcp';

run(
  'per-space grants: stored at consent, minted at authorize and refresh',
  () => {
    let s: h.Harness;
    let spaceA: number;
    let spaceB: number;

    beforeAll(async () => {
      s = await h.makeServer({
        AUTH_SERVER_SECRET: SECRET,
        AUTH_SERVER_RESOURCES: `${h.RESOURCE},${MCP}`,
      });
      await h.resetAsTables(s.pool);
      await h.seedPeople(s.pool, [h.PERSON]);
      const ids: number[] = [];
      for (const slug of ['g2a-space-a', 'g2a-space-b']) {
        const { rows } = await s.pool.query(
          `insert into spaces (title, slug) values ($1, $1)
         on conflict (slug) do update set title = excluded.title returning id`,
          [slug],
        );
        ids.push(rows[0].id);
      }
      [spaceA, spaceB] = ids as [number, number];
    });
    afterAll(async () => {
      await s.pool.end();
    });
    beforeEach(async () => {
      await s.pool.query('delete from as_oauth_consent');
      await s.pool.query('delete from as_client_grant');
    });

    const keys = async () =>
      createLocalJWKSet(
        await (await s.handler(h.req('/api/auth/jwks.json'))).json(),
      );
    const verify = async (token: string) =>
      verifyAccessToken(token, {
        audience: h.RESOURCE,
        issuer: h.ISSUER,
        keys: await keys(),
      });
    const refresh = (rt: string) =>
      h.tokenRequest(s, {
        grant_type: 'refresh_token',
        refresh_token: rt,
        client_id: h.CLIENT_ID,
        resource: h.RESOURCE,
      });

    it('"all" is stored as one header row and minted as the string "all"', async () => {
      const f = await h.fullFlow(s, { spaceGrants: 'all' });
      expect(f.stage).toBe('done');
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toBe('all');
      expect(decodeJwt(f.token!.body.access_token)[SPACE_GRANTS_CLAIM]).toBe(
        'all',
      );
      expect((await verify(f.token!.body.access_token)).spaceGrants).toBe(
        'all',
      );
    });

    it('a list is stored per space and minted as the ids; the verifier returns them', async () => {
      const f = await h.fullFlow(s, { spaceGrants: [spaceA] });
      expect(f.stage).toBe('done');
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceA]);
      expect(decodeJwt(f.token!.body.access_token)[SPACE_GRANTS_CLAIM]).toEqual(
        [spaceA],
      );
      expect((await verify(f.token!.body.access_token)).spaceGrants).toEqual([
        spaceA,
      ]);
    });

    it('the claim is minted again at refresh, from the stored grant (an edit applies at the next refresh)', async () => {
      const f = await h.fullFlow(s, { spaceGrants: [spaceA] });
      const rt = f.token!.body.refresh_token as string;
      await s.pool.query(
        `insert into as_client_grant_space ("userId", "clientId", "spaceId", level) values ($1, $2, $3, 'read')`,
        [h.PERSON, h.CLIENT_ID, spaceB],
      );
      const r = await refresh(rt);
      expect(r.res.status).toBe(200);
      const claim = decodeJwt(r.body.access_token)[
        SPACE_GRANTS_CLAIM
      ] as number[];
      expect([...claim].sort()).toEqual([spaceA, spaceB].sort());
      await s.pool.query(
        `update as_client_grant set mode = 'all' where "userId" = $1 and "clientId" = $2`,
        [h.PERSON, h.CLIENT_ID],
      );
      const r2 = await refresh(r.body.refresh_token);
      expect(decodeJwt(r2.body.access_token)[SPACE_GRANTS_CLAIM]).toBe('all');
    });

    it('a pair with no grant row gets an empty list at refresh, never "all"', async () => {
      const f = await h.fullFlow(s, { spaceGrants: 'all' });
      await s.pool.query('delete from as_client_grant');
      const r = await refresh(f.token!.body.refresh_token as string);
      expect(r.res.status).toBe(200);
      expect(decodeJwt(r.body.access_token)[SPACE_GRANTS_CLAIM]).toEqual([]);
    });

    it.each([
      ['no choice at all', null],
      ['an empty list', []],
      ['a string id', ['1']],
      ['a made-up keyword', 'everything'],
      ['an id of a space that does not exist', [2147483000]],
      [
        'more than the cap',
        Array.from({ length: MAX_SPACE_GRANTS + 1 }, (_, i) => i + 1),
      ],
    ])(
      'an approval with %s is refused and nothing is stored',
      async (_name, grants) => {
        const f = await h.fullFlow(s, { spaceGrants: grants });
        expect(f.stage).toBe('consent');
        expect(f.consent!.res.status).toBe(400);
        expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toBeNull();
      },
    );

    it('a refused library step puts the earlier grant back', async () => {
      const first = await h.fullFlow(s, { spaceGrants: [spaceA] });
      expect(first.stage).toBe('done');
      // A scope that was not asked for is refused by the library after the grant was written.
      const pkce = h.makePkce();
      const jar = new h.CookieJar();
      const u = h.authorizeUrl(pkce, { prompt: 'consent' });
      const a = await s.handler(h.req(u.pathname + u.search));
      const loc = new URL(a.headers.get('location')!, h.ISSUER);
      const login = await h.signIn(s, jar, loc.search.slice(1));
      const next = new URL(login.body.url, h.ISSUER);
      const c = await h.consent(
        s,
        jar,
        next.search.slice(1),
        'spaces:read admin:everything',
        h.PERSON,
        [spaceB],
      );
      expect(c.res.status).toBeGreaterThanOrEqual(400);
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceA]);
    });

    it('the choice is not read from an unsigned query', async () => {
      const f = await h.fullFlow(s, { spaceGrants: [spaceA] });
      expect(f.stage).toBe('done');
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
            scope: 'spaces:read',
            space_grants: 'all',
            oauth_query: `client_id=${encodeURIComponent(
              h.CLIENT_ID,
            )}&sig=forged`,
            expected_person: h.PERSON,
          }),
        }),
      );
      expect(res.status).toBe(400);
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceA]);
    });

    it('disconnecting an app removes its grants with the consent and tokens', async () => {
      await h.fullFlow(s, { spaceGrants: [spaceA, spaceB] });
      await disconnectApp(s.pool, h.PERSON, h.CLIENT_ID);
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toBeNull();
      const { rows } = await s.pool.query(
        'select count(*)::int as n from as_client_grant_space',
      );
      expect(rows[0].n).toBe(0);
    });

    it('deleting a space removes it from every grant', async () => {
      const { rows } = await s.pool.query(
        `insert into spaces (title, slug) values ('g2a-temp', 'g2a-temp')
       on conflict (slug) do update set title = excluded.title returning id`,
      );
      await h.fullFlow(s, { spaceGrants: [spaceA, rows[0].id] });
      await s.pool.query('delete from spaces where id = $1', [rows[0].id]);
      expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceA]);
    });

    it('the consent page offers only the scopes the MCP resource accepts', async () => {
      const pkce = h.makePkce();
      const jar = new h.CookieJar();
      const u = h.authorizeUrl(pkce, {
        scope: 'spaces:read agreements:vote offline_access',
        resource: MCP,
      });
      const a = await s.handler(h.req(u.pathname + u.search, { jar }));
      const loc = new URL(a.headers.get('location')!, h.ISSUER);
      const login = await h.signIn(s, jar, loc.search.slice(1));
      const next = new URL(login.body.url, h.ISSUER);
      const view = await loadConsentRequest(
        s,
        new Headers({ cookie: jar.header() }),
        next.search,
      );
      expect(view!.scopes.map((x) => x.scope).sort()).toEqual([
        'offline_access',
        'spaces:read',
      ]);
    });

    it('E52: an existing resource row picks up its allowed scopes, and a write scope alone is invalid_scope', async () => {
      // A row seeded earlier without a declaration (as in production before this release).
      await s.pool.query(
        `insert into as_oauth_resource (id, identifier, name, "allowedScopes", "createdAt", "updatedAt")
       values ('old-mcp', $1, $1, null, now(), now())
       on conflict (identifier) do update set "allowedScopes" = null`,
        [MCP],
      );
      const fresh = await h.makeServer({
        AUTH_SERVER_SECRET: SECRET,
        AUTH_SERVER_RESOURCES: `${h.RESOURCE},${MCP}`,
      });
      try {
        const pkce = h.makePkce();
        const u = h.authorizeUrl(pkce, {
          scope: 'agreements:vote',
          resource: MCP,
        });
        const a = await fresh.handler(h.req(u.pathname + u.search));
        expect(a.headers.get('location') ?? '').toContain('invalid_scope');
        const { rows } = await fresh.pool.query(
          'select "allowedScopes" from as_oauth_resource where identifier = $1',
          [MCP],
        );
        expect(rows[0].allowedScopes).toEqual([
          'spaces:read',
          'offline_access',
        ]);
      } finally {
        await fresh.pool.end();
      }
    });
  },
);
