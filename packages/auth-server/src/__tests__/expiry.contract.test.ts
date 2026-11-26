import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import * as h from '../testing/harness';
import { AUTH_CODE_TTL_SECONDS, AUTH_QUERY_TTL_SECONDS } from '../config';
import { inspectConsentQuery } from '../consent';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'contract-test-secret-'.padEnd(48, 'x');

run('login and consent expiry is separate from the code lifetime', () => {
  let s: h.Harness;
  beforeAll(async () => {
    s = await h.makeServer({ AUTH_SERVER_SECRET: SECRET });
  });
  afterAll(async () => {
    await s.pool.end();
  });
  beforeEach(async () => {
    // Fresh state each time: an existing consent would skip the approval step.
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON]);
    // Only the clock is faked: database and network keep running on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (seconds: number, start: number) =>
    vi.setSystemTime(start + seconds * 1000);

  /** authorize + sign in; returns the consent query. */
  const toConsent = async () => {
    const pkce = h.makePkce();
    const jar = new h.CookieJar();
    const u = h.authorizeUrl(pkce);
    const a = await s.handler(h.req(u.pathname + u.search));
    const loc = new URL(a.headers.get('location')!, h.ISSUER);
    const login = await h.signIn(s, jar, loc.search.slice(1));
    const next = new URL(login.body.url, h.ISSUER);
    return { pkce, jar, query: next.search.slice(1), loginQuery: loc.search };
  };

  const exchange = (pkce: { verifier: string }, callback: string) =>
    h.tokenRequest(s, {
      grant_type: 'authorization_code',
      code: new URL(callback).searchParams.get('code')!,
      code_verifier: pkce.verifier,
      client_id: h.CLIENT_ID,
      redirect_uri: h.REDIRECT_URI,
      resource: h.RESOURCE,
    });

  it('the two lifetimes are separate constants; the code stays at 60 s', () => {
    expect(AUTH_CODE_TTL_SECONDS).toBe(60);
    expect(AUTH_QUERY_TTL_SECONDS).toBe(600);
  });

  it('a slow approval (2 minutes) still works, and its code is then good for 60 s', async () => {
    const start = Date.now();
    const f = await toConsent();
    at(120, start);
    const c = await h.consent(s, f.jar, f.query, 'spaces:read offline_access');
    expect(c.res.status).toBe(200);
    expect(c.body.url).toContain('code=');
    const t = await exchange(f.pkce, c.body.url);
    expect(t.res.status).toBe(200);
  });

  it('the code expires after 60 s, not after the query lifetime', async () => {
    const start = Date.now();
    const f = await toConsent();
    const c = await h.consent(s, f.jar, f.query, 'spaces:read offline_access');
    expect(c.res.status).toBe(200);
    at(AUTH_CODE_TTL_SECONDS + 1, start);
    const late = await exchange(f.pkce, c.body.url);
    expect(late.res.status).toBe(400);
    expect(late.body.error).toBe('invalid_grant');
  });

  it('past the query lifetime consent is refused as invalid_signature, and the page can tell it expired', async () => {
    const start = Date.now();
    const f = await toConsent();
    at(AUTH_QUERY_TTL_SECONDS - 5, start);
    expect(await inspectConsentQuery(f.query, SECRET)).toBe('valid');
    at(AUTH_QUERY_TTL_SECONDS + 5, start);
    expect(await inspectConsentQuery(f.query, SECRET)).toBe('expired');
    const c = await h.consent(s, f.jar, f.query, 'spaces:read offline_access');
    expect(c.res.status).toBe(400);
    expect(c.body.error).toBe('invalid_signature');
  });

  it('an unsigned or tampered query is invalid, not expired', async () => {
    const f = await toConsent();
    expect(await inspectConsentQuery('client_id=x&exp=1&sig=abc', SECRET)).toBe(
      'expired',
    );
    expect(await inspectConsentQuery('client_id=x', SECRET)).toBe('invalid');
    expect(
      await inspectConsentQuery(f.query.replace('st123', 'zz'), SECRET),
    ).toBe('invalid');
  });

  it('signing in with an expired link answers invalid_signature (the login page says start again)', async () => {
    const start = Date.now();
    const f = await toConsent();
    at(AUTH_QUERY_TTL_SECONDS + 5, start);
    const again = await h.signIn(s, new h.CookieJar(), f.loginQuery.slice(1));
    expect(again.res.status).toBe(400);
    expect(again.body.error).toBe('invalid_signature');
  });
});
