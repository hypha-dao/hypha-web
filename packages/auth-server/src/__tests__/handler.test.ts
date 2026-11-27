import { describe, it, expect, vi } from 'vitest';
import { createAuthServerHandler, tokenSubjectAndClient } from '../handler';
import {
  CONNECTED_APPS_DISCONNECT_PATH,
  CONNECTED_APPS_SPACES_PATH,
} from '../config';
import type { AuthServerConfig } from '../config';

const ORIGIN = 'http://localhost:6274';

const config = {
  enabled: true,
  host: 'auth.localhost:3000',
  corsAllowedOrigins: [ORIGIN],
  dcrEnabled: false,
} as unknown as AuthServerConfig;

describe('handler error path', () => {
  it('a failing request still carries CORS headers for an allowed origin', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handle = createAuthServerHandler(
      () => config,
      () => {
        throw new Error('boom');
      },
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/token', {
        method: 'POST',
        headers: { origin: ORIGIN, host: 'auth.localhost:3000' },
      }),
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(await res.json()).toEqual({ error: 'server_error' });
  });

  it('no CORS header for an origin that is not allowed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handle = createAuthServerHandler(
      () => config,
      () => {
        throw new Error('boom');
      },
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/token', {
        method: 'POST',
        headers: {
          origin: 'https://evil.example.com',
          host: 'auth.localhost:3000',
        },
      }),
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('discovery HEAD and consent binding', () => {
  const fakeServer = (opts: {
    handler: (r: Request) => Promise<Response>;
    sessionUser?: string | null;
  }) =>
    ({
      config: { secret: 'handler-test-secret-'.padEnd(48, 'x') },
      // An approval must be refused before anything is stored: touching the database fails the test.
      pool: {
        query: async () => {
          throw new Error('database used');
        },
        connect: async () => {
          throw new Error('database used');
        },
      },
      auth: {
        handler: opts.handler,
        api: {
          getSession: async () =>
            opts.sessionUser ? { user: { id: opts.sessionUser } } : null,
        },
      },
    } as never);
  const make = (server: unknown) =>
    createAuthServerHandler(
      () => config,
      () => server as never,
    );
  const consent = (body: unknown) =>
    new Request('http://auth.localhost:3000/api/auth/oauth2/consent', {
      method: 'POST',
      headers: {
        host: 'auth.localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  it('HEAD on the discovery document passes the empty 200 through (no JSON parse, no 500)', async () => {
    const handle = make(
      fakeServer({ handler: async () => new Response(null, { status: 200 }) }),
    );
    const res = await handle(
      new Request(
        'http://auth.localhost:3000/.well-known/oauth-authorization-server',
        { method: 'HEAD', headers: { host: 'auth.localhost:3000' } },
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('refuses an approval without the displayed account, or from another session', async () => {
    const calls: Request[] = [];
    const handler = async (r: Request) => {
      calls.push(r);
      return new Response('{}', { status: 200 });
    };
    const body = { accept: true, scope: 'spaces:read', oauth_query: 'x' };
    const mine = make(fakeServer({ handler, sessionUser: 'did:privy:a' }));
    expect((await mine(consent(body))).status).toBe(400);
    const other = await mine(
      consent({ ...body, expected_person: 'did:privy:b' }),
    );
    expect(other.status).toBe(409);
    expect((await other.json()).error).toBe('account_changed');
    const signedOut = make(fakeServer({ handler, sessionUser: null }));
    expect(
      (await signedOut(consent({ ...body, expected_person: 'did:privy:a' })))
        .status,
    ).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it('the same account goes through, and the field never reaches the library', async () => {
    let seen: Record<string, unknown> = {};
    const handle = make(
      fakeServer({
        handler: async (r) => {
          seen = JSON.parse(await r.text());
          return new Response('{}', { status: 200 });
        },
        sessionUser: 'did:privy:a',
      }),
    );
    const res = await handle(
      consent({
        accept: false,
        space_grants: [1],
        oauth_query: 'x',
        expected_person: 'did:privy:a',
      }),
    );
    expect(res.status).toBe(200);
    // Neither the account field nor the space choice reaches the library.
    expect(seen).toEqual({ accept: false, oauth_query: 'x' });
  });

  it('an approval whose authorization query is not signed is refused before any grant is stored', async () => {
    let called = 0;
    const handle = make(
      fakeServer({
        handler: async () => {
          called += 1;
          return new Response('{}', { status: 200 });
        },
        sessionUser: 'did:privy:a',
      }),
    );
    const res = await handle(
      consent({
        accept: true,
        scope: 'spaces:read',
        space_grants: 'all',
        oauth_query: 'client_id=https%3A%2F%2Fapp.example%2Fc.json&sig=forged',
        expected_person: 'did:privy:a',
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_signature');
    expect(called).toBe(0);
  });
});

describe('connected-apps actions are refused before the database is touched', () => {
  const ISSUER = 'http://auth.localhost:3000';
  const appsConfig = {
    enabled: true,
    issuer: ISSUER,
    host: 'auth.localhost:3000',
    corsAllowedOrigins: [],
    dcrEnabled: false,
    allowedPersonIds: new Set(['did:privy:a']),
  } as unknown as AuthServerConfig;
  const server = (sessionUser: string | null) =>
    ({
      config: { secret: 'handler-test-secret-'.padEnd(48, 'x') },
      pool: {
        query: async () => {
          throw new Error('database used');
        },
        connect: async () => {
          throw new Error('database used');
        },
      },
      auth: {
        handler: async () => {
          throw new Error('library used');
        },
        api: {
          getSession: async () =>
            sessionUser ? { user: { id: sessionUser } } : null,
        },
      },
    } as never);
  const call = (
    sessionUser: string | null,
    body: unknown,
    headers: Record<string, string> = {},
    path = CONNECTED_APPS_DISCONNECT_PATH,
  ) =>
    createAuthServerHandler(
      () => appsConfig,
      () => server(sessionUser),
    )(
      new Request(`${ISSUER}/api/auth${path}`, {
        method: 'POST',
        headers: {
          host: 'auth.localhost:3000',
          origin: ISSUER,
          'content-type': 'application/json',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  const ok = { app: 'consent-1', expected_person: 'did:privy:a' };

  it.each([
    [
      'another origin',
      'did:privy:a',
      ok,
      { origin: 'https://evil.example' },
      403,
    ],
    ['no origin', 'did:privy:a', ok, { origin: '' }, 403],
    ['not JSON', 'did:privy:a', ok, { 'content-type': 'text/plain' }, 415],
    ['a body that is not an object', 'did:privy:a', '[1]', {}, 400],
    ['no session', null, ok, {}, 401],
    ['another account than the page showed', 'did:privy:b', ok, {}, 409],
    ['no displayed account', 'did:privy:a', { app: 'consent-1' }, {}, 409],
    [
      'a person outside the allowlist',
      'did:privy:z',
      { ...ok, expected_person: 'did:privy:z' },
      {},
      403,
    ],
    ['no app', 'did:privy:a', { expected_person: 'did:privy:a' }, {}, 400],
  ])('%s', async (_name, sessionUser, body, headers, status) => {
    const res = await call(sessionUser, body, headers);
    expect(res.status).toBe(status);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('changing spaces is guarded the same way', async () => {
    const res = await call(
      'did:privy:b',
      { ...ok, space_grants: 'all' },
      {},
      CONNECTED_APPS_SPACES_PATH,
    );
    expect(res.status).toBe(409);
  });

  it('only POST reaches the actions', async () => {
    const res = await createAuthServerHandler(
      () => appsConfig,
      () => server('did:privy:a'),
    )(
      new Request(`${ISSUER}/api/auth${CONNECTED_APPS_DISCONNECT_PATH}`, {
        headers: { host: 'auth.localhost:3000' },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('tokenSubjectAndClient (who a just-issued token is for)', () => {
  const jwt = (payload: Record<string, unknown>) =>
    `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

  it('reads the person and the client of a JWT', () => {
    expect(
      tokenSubjectAndClient(jwt({ sub: 'did:privy:a', client_id: 'c' })),
    ).toEqual({ personId: 'did:privy:a', clientId: 'c' });
    expect(tokenSubjectAndClient(jwt({ sub: 'p', azp: 'c2' }))).toEqual({
      personId: 'p',
      clientId: 'c2',
    });
  });

  it('anything else is null (an opaque token is looked up instead)', () => {
    expect(tokenSubjectAndClient('opaqueTokenValue')).toBeNull();
    expect(tokenSubjectAndClient(jwt({ client_id: 'c' }))).toBeNull();
    expect(tokenSubjectAndClient('a.%%%.b')).toBeNull();
    expect(tokenSubjectAndClient(undefined)).toBeNull();
  });
});
