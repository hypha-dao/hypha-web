import { describe, expect, it, vi } from 'vitest';

import type { ClientAuthResult } from '../../integration-client/server/authenticate-client';
import type { IntegrationClientSummary } from '../../integration-client/types';
import type {
  IntegrationGrantSummary,
  IntegrationGrantWithClient,
} from '../../integration-grant/types';
import {
  handleGetClientMe,
  handleListClientGrants,
  handleListUserGrants,
  handleOpsApproveClient,
  handleOpsListClients,
  handleOpsRevokeClient,
  handleOpsRotateClientKey,
  handleRegisterClientGrant,
  handleRequestClient,
  handleRevokeClientGrant,
  handleRevokeUserGrant,
  type IntegrationApiDeps,
  type UserAuthResult,
} from '../handlers';
import {
  INTEGRATION_API_RESPONSE_HEADERS,
  integrationJson,
} from '../response-headers';

const CLIENT = {
  id: 7,
  slug: 'acme',
  name: 'Acme',
  scopes: ['agreements:vote' as const],
};
const USER = { id: 42, email: 'person@example.com', name: 'Pat', slug: 'pat' };

const clientOk: ClientAuthResult = { ok: true, client: CLIENT };
const clientMissingKey: ClientAuthResult = {
  ok: false,
  status: 401,
  code: 'missing_key',
  error: 'Missing client key.',
};
const clientNotApproved: ClientAuthResult = {
  ok: false,
  status: 403,
  code: 'client_not_approved',
  error: 'This client is not approved.',
};
const userOk: UserAuthResult = { ok: true, user: USER };
const userNone: UserAuthResult = {
  ok: false,
  status: 401,
  error: 'Unauthorized',
};
const userNoProfile: UserAuthResult = {
  ok: false,
  status: 403,
  error: 'A Hypha profile is required',
};

const grant = (over: Partial<IntegrationGrantSummary> = {}) =>
  ({
    id: 1,
    clientId: CLIENT.id,
    personId: USER.id,
    scopes: ['agreements:vote'],
    status: 'active',
    grantedAt: new Date('2026-10-01T00:00:00Z'),
    revokedAt: null,
    ...over,
  } as IntegrationGrantSummary);

const clientSummary = (
  over: Partial<IntegrationClientSummary> = {},
): IntegrationClientSummary => ({
  id: 9,
  name: 'New Co',
  slug: 'new-co',
  contactEmail: 'person@example.com',
  description: null,
  status: 'pending',
  scopes: ['agreements:vote'],
  allowedOrigins: [],
  keyPrefix: null,
  requestedByPersonId: USER.id,
  approvedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});

/** Deps that succeed by default; every data function is a spy. */
function makeDeps(over: Partial<IntegrationApiDeps> = {}) {
  const deps = {
    authenticateClient: vi.fn(async () => clientOk),
    authenticateUser: vi.fn(async () => userOk),
    authorizeOps: vi.fn(() => null),
    requestClient: vi.fn(async () => clientSummary()),
    notifyClientRequested: vi.fn(async () => undefined),
    listClients: vi.fn(async () => [clientSummary()]),
    approveClient: vi.fn(async () => ({
      client: clientSummary({ status: 'approved' }),
      plaintext: 'key-once',
    })),
    revokeClient: vi.fn(async () => true),
    rotateClientKey: vi.fn(async () => ({
      client: clientSummary({ status: 'approved' }),
      plaintext: 'key-twice',
    })),
    registerGrant: vi.fn(async () => grant()),
    listClientGrants: vi.fn(async () => [grant()]),
    listUserGrants: vi.fn(
      async () =>
        [
          {
            ...grant(),
            client: { slug: CLIENT.slug, name: CLIENT.name },
          },
        ] as IntegrationGrantWithClient[],
    ),
    revokeGrant: vi.fn(async () => true),
    ...over,
  } satisfies IntegrationApiDeps;
  return deps;
}

const post = (body?: unknown, url = 'https://hypha.test/x') =>
  new Request(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = (url = 'https://hypha.test/x') => new Request(url);
const del = () => new Request('https://hypha.test/x', { method: 'DELETE' });

function expectHeaders(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS.Vary,
  );
}

describe('auth matrix: client key + user token routes', () => {
  const routes: Array<
    [string, (deps: IntegrationApiDeps) => Promise<Response>]
  > = [
    ['POST clients/me/grants', (d) => handleRegisterClientGrant(post({}), d)],
    ['GET clients/me/grants', (d) => handleListClientGrants(get(), d)],
    [
      'DELETE clients/me/grants/{id}',
      (d) => handleRevokeClientGrant(del(), { id: '3' }, d),
    ],
  ];

  it.each(routes)(
    '%s: missing or bad key is 401 with a code',
    async (_n, run) => {
      const deps = makeDeps({
        authenticateClient: vi.fn(async () => clientMissingKey),
      });
      const response = await run(deps);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: 'missing_key' });
      expect(deps.authenticateUser).not.toHaveBeenCalled();
      expectHeaders(response);
    },
  );

  it.each(routes)('%s: unapproved client is 403', async (_n, run) => {
    const deps = makeDeps({
      authenticateClient: vi.fn(async () => clientNotApproved),
    });
    const response = await run(deps);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'client_not_approved',
    });
    expectHeaders(response);
  });

  it.each(routes)(
    '%s: key alone, without a user token, is 401',
    async (_n, run) => {
      const deps = makeDeps({ authenticateUser: vi.fn(async () => userNone) });
      const response = await run(deps);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      expect(deps.registerGrant).not.toHaveBeenCalled();
      expect(deps.revokeGrant).not.toHaveBeenCalled();
      expectHeaders(response);
    },
  );

  it.each(routes)(
    '%s: a user without a Hypha profile is 403',
    async (_n, run) => {
      const deps = makeDeps({
        authenticateUser: vi.fn(async () => userNoProfile),
      });
      const response = await run(deps);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'A Hypha profile is required',
      });
      expectHeaders(response);
    },
  );
});

describe('auth matrix: user token only routes', () => {
  const routes: Array<
    [string, (deps: IntegrationApiDeps) => Promise<Response>]
  > = [
    [
      'POST clients/requests',
      (d) =>
        handleRequestClient(
          post({ name: 'X', scopes: ['agreements:vote'] }),
          d,
        ),
    ],
    ['GET users/me/grants', (d) => handleListUserGrants(get(), d)],
    [
      'DELETE users/me/grants/{id}',
      (d) => handleRevokeUserGrant(del(), { id: '3' }, d),
    ],
  ];

  it.each(routes)('%s: no valid token is 401', async (_n, run) => {
    const deps = makeDeps({ authenticateUser: vi.fn(async () => userNone) });
    const response = await run(deps);
    expect(response.status).toBe(401);
    expect(deps.requestClient).not.toHaveBeenCalled();
    expectHeaders(response);
  });

  it.each(routes)('%s: no Hypha profile is 403', async (_n, run) => {
    const deps = makeDeps({
      authenticateUser: vi.fn(async () => userNoProfile),
    });
    const response = await run(deps);
    expect(response.status).toBe(403);
    expectHeaders(response);
  });

  it.each(routes)('%s: never asks for a client key', async (_n, run) => {
    const deps = makeDeps();
    await run(deps);
    expect(deps.authenticateClient).not.toHaveBeenCalled();
  });
});

describe('auth matrix: ops routes', () => {
  const denied = () =>
    integrationJson({ error: 'Unauthorized' }, { status: 401 });
  const routes: Array<
    [string, (deps: IntegrationApiDeps) => Promise<Response>]
  > = [
    ['GET ops/clients', (d) => handleOpsListClients(get(), d)],
    [
      'POST ops/clients/{slug}/approve',
      (d) => handleOpsApproveClient(post(), { slug: 'a' }, d),
    ],
    [
      'POST ops/clients/{slug}/revoke',
      (d) => handleOpsRevokeClient(post(), { slug: 'a' }, d),
    ],
    [
      'POST ops/clients/{slug}/rotate-key',
      (d) => handleOpsRotateClientKey(post(), { slug: 'a' }, d),
    ],
  ];

  it.each(routes)(
    '%s: refused without the ops secret, nothing touched',
    async (_n, run) => {
      const deps = makeDeps({ authorizeOps: vi.fn(denied) });
      const response = await run(deps);
      expect(response.status).toBe(401);
      expect(deps.listClients).not.toHaveBeenCalled();
      expect(deps.approveClient).not.toHaveBeenCalled();
      expect(deps.revokeClient).not.toHaveBeenCalled();
      expect(deps.rotateClientKey).not.toHaveBeenCalled();
      expect(deps.authenticateClient).not.toHaveBeenCalled();
      expect(deps.authenticateUser).not.toHaveBeenCalled();
      expectHeaders(response);
    },
  );

  it.each(routes)(
    '%s: a client key or user token is not an ops credential',
    async (_n, run) => {
      const deps = makeDeps();
      await run(deps);
      expect(deps.authenticateClient).not.toHaveBeenCalled();
      expect(deps.authenticateUser).not.toHaveBeenCalled();
    },
  );

  it('returns the key once on approve and rotate, with headers', async () => {
    const deps = makeDeps();
    const approved = await handleOpsApproveClient(post(), { slug: 'a' }, deps);
    expect(await approved.json()).toMatchObject({ clientKey: 'key-once' });
    expectHeaders(approved);
    const rotated = await handleOpsRotateClientKey(post(), { slug: 'a' }, deps);
    expect(await rotated.json()).toMatchObject({ clientKey: 'key-twice' });
    expectHeaders(rotated);
  });

  it('maps unknown slugs to 404 and keeps the headers', async () => {
    const deps = makeDeps({
      approveClient: vi.fn(async () => null),
      revokeClient: vi.fn(async () => false),
      rotateClientKey: vi.fn(async () => null),
    });
    for (const response of [
      await handleOpsApproveClient(post(), { slug: 'x' }, deps),
      await handleOpsRevokeClient(post(), { slug: 'x' }, deps),
      await handleOpsRotateClientKey(post(), { slug: 'x' }, deps),
    ]) {
      expect(response.status).toBe(404);
      expectHeaders(response);
    }
  });

  it('paginates the client list', async () => {
    const deps = makeDeps({
      listClients: vi.fn(async () => [
        clientSummary({ slug: 'a' }),
        clientSummary({ slug: 'b' }),
        clientSummary({ slug: 'c' }),
      ]),
    });
    const response = await handleOpsListClients(
      get('https://hypha.test/x?page=2&pageSize=2'),
      deps,
    );
    const body = await response.json();
    expect(body.data.map((c: { slug: string }) => c.slug)).toEqual(['c']);
    expectHeaders(response);
  });
});

describe('clients/me/grants: scoping to the calling client', () => {
  it('lists with the client from the key and the person from the token only', async () => {
    const deps = makeDeps();
    const response = await handleListClientGrants(
      get('https://hypha.test/x?clientId=999&personId=1'),
      deps,
    );
    expect(deps.listClientGrants).toHaveBeenCalledWith({
      clientId: CLIENT.id,
      personId: USER.id,
    });
    expect(response.status).toBe(200);
    expectHeaders(response);
  });

  it('returns summaries only: no internal ids, email or subject', async () => {
    const response = await handleListClientGrants(get(), makeDeps());
    const { grants } = await response.json();
    expect(grants).toEqual([
      {
        id: 1,
        scopes: ['agreements:vote'],
        status: 'active',
        grantedAt: '2026-10-01T00:00:00.000Z',
        revokedAt: null,
      },
    ]);
    const text = JSON.stringify(grants);
    expect(text).not.toMatch(/clientId|personId|email|sub|privy/i);
  });

  it('shows "already consented" as an active item and keeps history after revoke', async () => {
    const deps = makeDeps({
      listClientGrants: vi.fn(async () => [
        grant({ id: 5 }),
        grant({ id: 2, status: 'revoked', revokedAt: new Date('2026-09-01') }),
      ]),
    });
    const { grants } = await (await handleListClientGrants(get(), deps)).json();
    expect(grants.map((g: { status: string }) => g.status)).toEqual([
      'active',
      'revoked',
    ]);
  });

  it('revokes with the calling client id, so only its own grant can change', async () => {
    const deps = makeDeps();
    const response = await handleRevokeClientGrant(del(), { id: '12' }, deps);
    expect(deps.revokeGrant).toHaveBeenCalledWith({
      grantId: 12,
      personId: USER.id,
      clientId: CLIENT.id,
    });
    expect(await response.json()).toEqual({ revoked: true, id: 12 });
    expectHeaders(response);
  });

  it('answers 404 when nothing active matched (another client or person)', async () => {
    const deps = makeDeps({ revokeGrant: vi.fn(async () => false) });
    const response = await handleRevokeClientGrant(del(), { id: '12' }, deps);
    expect(response.status).toBe(404);
    expectHeaders(response);
  });

  it.each(['abc', '0', '-1', '1junk', '1.5', ''])(
    'rejects the grant id %j with 400 before any lookup',
    async (id) => {
      const deps = makeDeps();
      const a = await handleRevokeClientGrant(del(), { id }, deps);
      const b = await handleRevokeUserGrant(del(), { id }, deps);
      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(deps.revokeGrant).not.toHaveBeenCalled();
      expectHeaders(a);
    },
  );
});

describe('clients/me/grants: registration', () => {
  it('takes client and person from the credentials, never the body', async () => {
    const deps = makeDeps();
    const response = await handleRegisterClientGrant(
      post({ clientId: 999, personId: 1, scopes: ['agreements:vote'] }),
      deps,
    );
    expect(deps.registerGrant).toHaveBeenCalledWith({
      clientId: CLIENT.id,
      personId: USER.id,
      scopes: ['agreements:vote'],
    });
    expect(response.status).toBe(200);
    expect((await response.json()).grant).toEqual({
      id: 1,
      scopes: ['agreements:vote'],
      status: 'active',
      grantedAt: '2026-10-01T00:00:00.000Z',
      revokedAt: null,
    });
    expectHeaders(response);
  });

  it('an empty body grants all of the client scopes', async () => {
    const deps = makeDeps();
    await handleRegisterClientGrant(post(), deps);
    expect(deps.registerGrant).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: CLIENT.scopes }),
    );
  });

  it('refuses scopes beyond the client scopes with 403', async () => {
    const deps = makeDeps({
      authenticateClient: vi.fn(async () => ({
        ok: true as const,
        client: { ...CLIENT, scopes: [] },
      })),
    });
    const response = await handleRegisterClientGrant(
      post({ scopes: ['agreements:vote'] }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(deps.registerGrant).not.toHaveBeenCalled();
    expectHeaders(response);
  });

  it('rejects invalid JSON and unknown scopes with 400', async () => {
    const deps = makeDeps();
    const bad = await handleRegisterClientGrant(
      new Request('https://hypha.test/x', { method: 'POST', body: '{nope' }),
      deps,
    );
    expect(bad.status).toBe(400);
    const unknown = await handleRegisterClientGrant(
      post({ scopes: ['wallet:drain'] }),
      deps,
    );
    expect(unknown.status).toBe(400);
    expect(deps.registerGrant).not.toHaveBeenCalled();
  });

  it('is idempotent at the handler: the same pair gets the same grant id', async () => {
    // One active grant per client and person is enforced by
    // `registerIntegrationGrant` (advisory lock plus a partial unique index);
    // the handler must always pass the same pair and return what it gives back.
    const deps = makeDeps();
    const first = await (await handleRegisterClientGrant(post(), deps)).json();
    const second = await (await handleRegisterClientGrant(post(), deps)).json();
    expect(first.grant.id).toBe(second.grant.id);
    const [a, b] = vi.mocked(deps.registerGrant).mock.calls;
    expect(a).toEqual(b);
  });

  it('a failure is a 500 with no detail, and keeps the headers', async () => {
    const deps = makeDeps({
      registerGrant: vi.fn(async () => {
        throw new Error('db down');
      }),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleRegisterClientGrant(post(), deps);
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to register the grant',
    });
    expectHeaders(response);
  });
});

describe('users/me/grants', () => {
  it('lists across clients with the client identity and no internal ids', async () => {
    const deps = makeDeps();
    const response = await handleListUserGrants(get(), deps);
    expect(deps.listUserGrants).toHaveBeenCalledWith({ personId: USER.id });
    const { grants } = await response.json();
    expect(grants[0]).toMatchObject({
      id: 1,
      status: 'active',
      client: { slug: 'acme', name: 'Acme' },
    });
    expect(JSON.stringify(grants)).not.toMatch(/clientId|personId/);
    expectHeaders(response);
  });

  it("revokes any of the user's grants without a client filter", async () => {
    const deps = makeDeps();
    await handleRevokeUserGrant(del(), { id: '4' }, deps);
    expect(deps.revokeGrant).toHaveBeenCalledWith({
      grantId: 4,
      personId: USER.id,
    });
  });
});

describe('clients/me and clients/requests', () => {
  it('clients/me returns the calling client only, no id or key material', async () => {
    const response = await handleGetClientMe(get(), makeDeps());
    expect(await response.json()).toEqual({
      client: {
        slug: 'acme',
        name: 'Acme',
        status: 'approved',
        scopes: ['agreements:vote'],
      },
    });
    expectHeaders(response);
  });

  it('request: 202 with slug and status only, contact defaults to the account email', async () => {
    const deps = makeDeps();
    const response = await handleRequestClient(
      post({ name: 'New Co', scopes: ['agreements:vote'] }),
      deps,
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      slug: 'new-co',
      status: 'pending',
    });
    expect(deps.requestClient).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: USER.email, name: 'New Co' }),
      { id: USER.id },
    );
    expect(deps.notifyClientRequested).toHaveBeenCalledOnce();
    expectHeaders(response);
  });

  it('request: validation, too many pending and name clash', async () => {
    const invalid = await handleRequestClient(post({ name: '' }), makeDeps());
    expect(invalid.status).toBe(400);

    const tooMany = new Error('x');
    tooMany.name = 'TooManyPendingRequestsError';
    const many = await handleRequestClient(
      post({ name: 'A', scopes: ['agreements:vote'] }),
      makeDeps({
        requestClient: vi.fn(async () => {
          throw tooMany;
        }),
      }),
    );
    expect(many.status).toBe(429);

    const clash = await handleRequestClient(
      post({ name: 'A', scopes: ['agreements:vote'] }),
      makeDeps({
        requestClient: vi.fn(async () => {
          throw {
            code: '23505',
            constraint: 'integration_clients_slug_unique',
          };
        }),
      }),
    );
    expect(clash.status).toBe(409);
    expectHeaders(clash);
  });
});
