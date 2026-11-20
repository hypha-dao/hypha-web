import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import {
  createMcpRequestHandlers,
  type McpRequestDeps,
} from '../request-handler';
import { loadMcpConfig } from '../config';
import {
  TEST_ISSUER,
  TEST_PERSON,
  createTestIssuer,
} from '../../__tests__/test-issuer';

const HOST = 'mcp.example.com';
const AUDIENCE = `https://${HOST}/mcp`;
const METADATA = `https://${HOST}/.well-known/oauth-protected-resource/mcp`;

let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
beforeAll(async () => {
  issuer = await createTestIssuer();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

const emptyList = {
  ok: true as const,
  data: {
    items: [],
    total: 0,
    asOf: '2026-11-19T00:00:00.000Z',
    asOfBlock: 1,
    slugById: new Map(),
    memberCountByWeb3Id: new Map(),
  },
};

function setup(
  env: Record<string, string | undefined> = {},
  over: Partial<McpRequestDeps> = {},
) {
  const logs: unknown[] = [];
  const config = loadMcpConfig(
    { MCP_SERVER_ENABLED: 'true', ...env },
    {
      enabled: true,
      issuer: TEST_ISSUER,
      resources: [AUDIENCE],
      allowedPersonIds: new Set([TEST_PERSON]),
    },
  );
  const features = {
    listSpaces: vi.fn(async () => emptyList),
    getMyMembership: vi.fn(async () => ({
      ok: true as const,
      data: { isMember: false, isDelegate: false, asOf: 'x', asOfBlock: null },
    })),
  };
  const deps: McpRequestDeps = {
    getConfig: () => config,
    resolve: async () =>
      ({
        ok: true,
        caller: {
          kind: 'user',
          person: { id: 1 },
          address: '0x1',
          via: { clientId: 'c', scopes: [], spaceGrants: null },
        },
      } as never),
    features: features as never,
    spaceUrl: (slug) => `https://app.example/en/dho/${slug}/overview`,
    keys: issuer.keys as never,
    log: (e) => logs.push(e),
    ...over,
  };
  return { handlers: createMcpRequestHandlers(deps), features, logs };
}

const post = (url: string, init: RequestInit & { host?: string } = {}) =>
  new Request(url, {
    method: 'POST',
    headers: {
      host: init.host ?? HOST,
      'content-type': 'application/json',
      ...(init.headers as object),
    },
    body: init.body ?? '{}',
  });

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization' };
const expectHeaders = (r: Response) => {
  expect(r.headers.get('cache-control')).toBe(HEADERS['cache-control']);
  expect(r.headers.get('vary')).toBe(HEADERS.vary);
};

describe('entry conditions', () => {
  it('404 on any other host, with no hint that the server exists', async () => {
    const { handlers } = setup();
    for (const host of ['app.hypha.earth', 'auth.hypha.earth']) {
      const r = await handlers.mcp(post('https://x/mcp', { host }));
      expect(r.status).toBe(404);
      expectHeaders(r);
    }
    const m = await handlers.metadata(
      new Request('https://x/', { headers: { host: 'app.hypha.earth' } }),
    );
    expect(m.status).toBe(404);
  });

  it('off unless the flag is on: the clear unavailable answer on its own host', async () => {
    for (const env of [
      { MCP_SERVER_ENABLED: undefined },
      { MCP_SERVER_ENABLED: 'yes' },
      { MCP_SERVER_KILL_SWITCH: 'true' },
      { VERCEL_ENV: 'preview' },
    ]) {
      const { handlers } = setup(env);
      const r = await handlers.mcp(post(AUDIENCE));
      expect(r.status).toBe(503);
      expect(await r.json()).toMatchObject({
        error: 'temporarily_unavailable',
      });
      expectHeaders(r);
    }
  });

  it('no token: 401 with the challenge pointing at the metadata', async () => {
    const { handlers } = setup();
    const r = await handlers.mcp(post(AUDIENCE));
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toContain(
      `resource_metadata="${METADATA}"`,
    );
    expectHeaders(r);
  });

  it('a garbage bearer: 401 invalid_token', async () => {
    const { handlers } = setup();
    const r = await handlers.mcp(
      post(AUDIENCE, { headers: { authorization: 'Bearer nope' } }),
    );
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('a request with an Origin header is rejected, even with a valid token', async () => {
    const { handlers } = setup();
    const token = await issuer.sign(AUDIENCE);
    const r = await handlers.mcp(
      post(AUDIENCE, {
        headers: {
          authorization: `Bearer ${token}`,
          origin: 'https://example.invalid',
        },
      }),
    );
    expect(r.status).toBe(403);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('a token for another resource is refused', async () => {
    const { handlers } = setup();
    const token = await issuer.sign('https://other.example.com/mcp');
    const r = await handlers.mcp(
      post(AUDIENCE, { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(r.status).toBe(401);
  });

  it('an unexpected exception is a 500 without detail, with the headers', async () => {
    const { handlers } = setup(
      {},
      {
        resolve: async () => {
          throw new Error('secret db detail');
        },
      },
    );
    const token = await issuer.sign(AUDIENCE);
    const r = await handlers.mcp(
      post(AUDIENCE, { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain('secret');
    expectHeaders(r);
  });
});

describe('protected-resource metadata', () => {
  it('names the resource, the issuer and the scopes', async () => {
    const { handlers } = setup();
    const r = await handlers.metadata(
      new Request(METADATA, { headers: { host: HOST } }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      resource: AUDIENCE,
      authorization_servers: [TEST_ISSUER],
      scopes_supported: ['spaces:read', 'offline_access'],
      bearer_methods_supported: ['header'],
      resource_name: 'Hypha',
    });
    expectHeaders(r);
  });

  it('answers unavailable while off, not 404 (post-deploy check with the flag off)', async () => {
    const { handlers } = setup({ MCP_SERVER_ENABLED: undefined });
    const r = await handlers.metadata(
      new Request(METADATA, { headers: { host: HOST } }),
    );
    expect(r.status).toBe(503);
  });
});

/** The real SDK client over the handler (in process): list tools and call both. */
async function connectClient(
  handlers: ReturnType<typeof setup>['handlers'],
  token: string,
  negotiate: 'auto' | 'legacy' = 'auto',
) {
  const transport = new StreamableHTTPClientTransport(new URL(AUDIENCE), {
    fetch: (input, init) => {
      const request = new Request(input as string, init);
      request.headers.set('host', HOST);
      return handlers.mcp(request);
    },
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  // The SDK client defaults to the 2025 handshake; the modern era is opt-in.
  const client = new Client(
    { name: 'test', version: '0.0.0' },
    { versionNegotiation: { mode: negotiate } },
  );
  await client.connect(transport);
  return client;
}

describe('the real SDK client against the handler', () => {
  it('lists the tools and calls them for the resolved caller', async () => {
    const { handlers, features, logs } = setup();
    const client = await connectClient(handlers, await issuer.sign(AUDIENCE));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      'hypha_list_spaces',
      'hypha_get_space',
      'hypha_get_my_membership',
    ]);

    const list = await client.callTool({
      name: 'hypha_list_spaces',
      arguments: {},
    });
    expect((list as { isError?: boolean }).isError).toBeFalsy();
    expect(features.listSpaces).toHaveBeenCalledTimes(1);
    const callerPassed = (
      features.listSpaces.mock.calls as unknown as [unknown, { kind: string }][]
    )[0]![1];
    expect(callerPassed.kind).toBe('user');

    const m = await client.callTool({
      name: 'hypha_get_my_membership',
      arguments: { spaceSlug: 'alpha' },
    });
    expect(
      (m as { structuredContent?: unknown }).structuredContent,
    ).toMatchObject({
      isMember: false,
      isDelegate: false,
    });
    expect(logs).toHaveLength(2);
    await client.close();
  });

  it('legacy: reject (D34): a client that only speaks the 2025 handshake cannot connect', async () => {
    const { handlers } = setup();
    await expect(
      connectClient(handlers, await issuer.sign(AUDIENCE), 'legacy'),
    ).rejects.toThrow(/protocol version/i);
  });

  it('a person without a profile gets a clear tool error and no data', async () => {
    const { handlers, features } = setup(
      {},
      {
        resolve: async () =>
          ({
            ok: false,
            code: 'no_profile',
            message: 'No Hypha profile exists.',
          } as never),
      },
    );
    const client = await connectClient(handlers, await issuer.sign(AUDIENCE));
    const r = (await client.callTool({
      name: 'hypha_list_spaces',
      arguments: {},
    })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain('No Hypha profile');
    expect(features.listSpaces).not.toHaveBeenCalled();
    await client.close();
  });

  it('a tripped limit is a tool error with retry info', async () => {
    const { handlers, features } = setup(
      {},
      {
        slot: { take: () => ({ ok: false, retryAfterSeconds: 9 }) },
      },
    );
    const client = await connectClient(handlers, await issuer.sign(AUDIENCE));
    const r = (await client.callTool({
      name: 'hypha_list_spaces',
      arguments: {},
    })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Try again in \d+ seconds/);
    expect(features.listSpaces).not.toHaveBeenCalled();
    await client.close();
  });
});
