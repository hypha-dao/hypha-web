import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decodeJwt } from 'jose';
import * as h from '../testing/harness';
import { loadConsentRequest } from '../consent';
import {
  CIMD_ALLOWED_SCOPES,
  CLIENT_REGISTRATION_CEILING_SCOPES,
  DCR_ALLOWED_SCOPES,
  scopesForClientKind,
} from '../config';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'client-kind-scopes-secret-'.padEnd(48, 'x');
const MCP = 'http://localhost:4000/mcp';
// A row the library could only have created through dynamic registration: no discovery id.
const DCR_APP = 'dcr-claimed-app';
const DCR_CB = 'https://dcr.example.com/callback';

describe('scope lists per client kind', () => {
  it('DCR keeps its list; CIMD adds signals:write; the library ceiling is their union', () => {
    expect([...DCR_ALLOWED_SCOPES]).toEqual([
      'spaces:read',
      'agreements:vote',
      'offline_access',
    ]);
    expect(CIMD_ALLOWED_SCOPES).toContain('signals:write');
    expect([...CLIENT_REGISTRATION_CEILING_SCOPES].sort()).toEqual(
      [...new Set([...DCR_ALLOWED_SCOPES, ...CIMD_ALLOWED_SCOPES])].sort(),
    );
    expect(scopesForClientKind('dcr')).not.toContain('signals:write');
    expect(scopesForClientKind('cimd')).toContain('signals:write');
  });
});

run('signals:write per client kind (#2744)', () => {
  let s: h.Harness;

  beforeAll(async () => {
    s = await h.makeServer({
      AUTH_SERVER_SECRET: SECRET,
      AUTH_SERVER_RESOURCES: `${h.RESOURCE},${MCP}`,
      MCP_WRITES_ENABLED: 'true',
    });
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON]);
    // As if registered dynamically and then altered: even a row that lists signals:write is held
    // to the DCR list at consent.
    await s.pool.query(
      `insert into as_oauth_client (id, "clientId", name, "redirectUris", scopes, "tokenEndpointAuthMethod",
       "grantTypes", "responseTypes", "requirePKCE", "skipConsent", "createdAt", "updatedAt", metadata)
       values ('dcr1', $1, 'Claimed App', $2::jsonb, $3::jsonb, 'none',
       '["authorization_code","refresh_token"]', '["code"]', true, false, now(), now(),
       '{"registration":"dcr"}'::jsonb)`,
      [
        DCR_APP,
        JSON.stringify([DCR_CB]),
        JSON.stringify([...CLIENT_REGISTRATION_CEILING_SCOPES]),
      ],
    );
  });
  afterAll(async () => {
    await s.pool.end();
  });
  beforeEach(async () => {
    await s.pool.query('delete from as_oauth_consent');
    await s.pool.query('delete from as_client_grant');
  });

  /** authorize + sign in; returns the authorize response and what the consent page needs. */
  const toConsent = async (
    scope: string,
    client: { client_id: string; redirect_uri: string } = {
      client_id: h.CLIENT_ID,
      redirect_uri: h.REDIRECT_URI,
    },
  ) => {
    const pkce = h.makePkce();
    const jar = new h.CookieJar();
    const u = h.authorizeUrl(pkce, { ...client, scope, resource: MCP });
    const a = await s.handler(h.req(u.pathname + u.search, { jar }));
    const loc = new URL(a.headers.get('location')!, h.ISSUER);
    if (loc.searchParams.get('error')) return { pkce, jar, error: loc };
    const login = await h.signIn(s, jar, loc.search.slice(1));
    return { pkce, jar, next: new URL(login.body.url, h.ISSUER) };
  };

  it('a metadata-document client may ask for signals:write: no invalid_scope, offered on consent, issued', async () => {
    const f = await toConsent('spaces:read signals:write');
    expect(f.error).toBeUndefined();

    const { rows } = await s.pool.query(
      'select scopes from as_oauth_client where "clientId" = $1',
      [h.CLIENT_ID],
    );
    expect(rows[0].scopes).toContain('signals:write');

    const view = (await loadConsentRequest(
      s,
      new Headers({ cookie: f.jar.header() }),
      f.next!.search,
    ))!;
    expect(view.client.kind).toBe('cimd');
    expect(view.scopes.map((x) => x.scope)).toContain('signals:write');

    const c = await h.consent(
      s,
      f.jar,
      f.next!.search.slice(1),
      'spaces:read signals:write offline_access',
    );
    expect(c.res.status).toBe(200);
    const t = await h.tokenRequest(s, {
      grant_type: 'authorization_code',
      code: new URL(c.body.url).searchParams.get('code')!,
      code_verifier: f.pkce.verifier,
      client_id: h.CLIENT_ID,
      redirect_uri: h.REDIRECT_URI,
      resource: MCP,
    });
    expect(t.res.status).toBe(200);
    expect(String(decodeJwt(t.body.access_token).scope).split(' ')).toContain(
      'signals:write',
    );
  });

  it('a DCR client is never offered signals:write, and a forged approval of it is refused', async () => {
    const f = await toConsent('spaces:read signals:write', {
      client_id: DCR_APP,
      redirect_uri: DCR_CB,
    });
    expect(f.error).toBeUndefined();
    const view = (await loadConsentRequest(
      s,
      new Headers({ cookie: f.jar.header() }),
      f.next!.search,
    ))!;
    expect(view.client.kind).toBe('dcr');
    expect(view.scopes.map((x) => x.scope)).not.toContain('signals:write');

    const forged = await h.consent(
      s,
      f.jar,
      f.next!.search.slice(1),
      'spaces:read signals:write',
    );
    expect(forged.res.status).toBe(400);
    expect(forged.body.error).toBe('invalid_scope');
    const { rows } = await s.pool.query(
      'select count(*)::int as n from as_oauth_consent',
    );
    expect(rows[0].n).toBe(0);

    // Its own scopes still work.
    const ok = await h.consent(
      s,
      f.jar,
      f.next!.search.slice(1),
      'spaces:read',
    );
    expect(ok.res.status).toBe(200);
  });
});
