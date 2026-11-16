import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import type { AuthServerConfig } from '@hypha-platform/auth-server/server';
import type { McpDeps, McpPerson } from '@hypha-platform/mcp-server/http';
import { createMcpRoute } from '../mcp-route';

const ISSUER = 'http://auth.localhost:3000';
const RESOURCE = 'http://localhost:3000/api/mcp';
const METADATA =
  'http://localhost:3000/.well-known/oauth-protected-resource/api/mcp';
const A = 'did:privy:a';
const B = 'did:privy:b';
const DENIED = 'did:privy:denied';

const config = {
  enabled: true,
  issuer: ISSUER,
  resources: [RESOURCE, 'http://localhost:3000/api/v2'],
  allowedPersonIds: new Set([A, B]),
} as unknown as AuthServerConfig;

const { privateKey, publicKey } = await generateKeyPair('ES256');
const other = await generateKeyPair('ES256');

const people: Record<string, McpPerson> = {
  [A]: { name: 'Ada', slug: 'ada', address: '0xaaa' },
  [B]: { name: 'Bob', slug: 'bob', address: '0xbbb' },
};
const seen: string[] = [];
const deps: McpDeps = {
  findPerson: async (sub) => people[sub] ?? null,
  readMembership: async ({ person, spaceSlug }) => {
    seen.push(`${person.slug}@${spaceSlug}`);
    return {
      ok: true,
      body: { isMember: true, isDelegate: false, asOf: 'now' },
    };
  },
};

const route = createMcpRoute({
  getConfig: () => config,
  deps: () => deps,
  keys: async () => publicKey,
});

async function token(
  over: {
    sub?: string;
    aud?: string;
    scope?: string;
    iss?: string;
    exp?: string;
    key?: typeof privateKey;
  } = {},
) {
  return new SignJWT({
    client_id: 'https://client.example.com/cimd.json',
    scope: over.scope ?? 'spaces:read offline_access',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'at+jwt' })
    .setSubject(over.sub ?? A)
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? RESOURCE)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? '5m')
    .sign(over.key ?? privateKey);
}

function post(bearer?: string, body: unknown = call('hypha')) {
  return new Request(RESOURCE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
const call = (spaceSlug: string) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'my_space_membership', arguments: { spaceSlug } },
});

describe('MCP route: every request is guarded', () => {
  it('no token: 401 with a challenge that points at the metadata', async () => {
    const res = await route.POST(post());
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${METADATA}"`,
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['garbage token', async () => 'not-a-jwt'],
    [
      'wrong audience (the API v2 one)',
      async () => token({ aud: 'http://localhost:3000/api/v2' }),
    ],
    ['wrong audience (other path)', async () => token({ aud: `${RESOURCE}/` })],
    ['wrong issuer', async () => token({ iss: 'http://evil.example' })],
    ['expired', async () => token({ exp: '-1m' })],
    ['foreign signature', async () => token({ key: other.privateKey })],
  ])('%s: 401 invalid_token', async (_n, make) => {
    const res = await route.POST(post(await make()));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${METADATA}", error="invalid_token"`,
    );
  });

  it('person not on the whitelist: 403 on every request', async () => {
    const t = await token({ sub: DENIED });
    for (let i = 0; i < 2; i++) {
      const res = await route.POST(post(t));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'access_denied' });
    }
  });

  it('missing scope: 403 insufficient_scope', async () => {
    const res = await route.POST(
      post(await token({ scope: 'offline_access' })),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toContain(
      'error="insufficient_scope"',
    );
    expect(res.headers.get('www-authenticate')).toContain(
      'scope="spaces:read"',
    );
  });

  it('the whitelist is read on each request, not once', async () => {
    const live = {
      ...config,
      allowedPersonIds: new Set([A]),
    } as unknown as AuthServerConfig;
    const r = createMcpRoute({
      getConfig: () => live,
      deps: () => deps,
      keys: async () => publicKey,
    });
    const t = await token();
    expect((await r.POST(post(t))).status).toBe(200);
    (live as unknown as { allowedPersonIds: Set<string> }).allowedPersonIds =
      new Set();
    expect((await r.POST(post(t))).status).toBe(403);
  });

  it('GET and DELETE need a token too, then answer 405', async () => {
    const t = await token();
    for (const method of ['GET', 'DELETE']) {
      const bare = await route[method as 'GET'](
        new Request(RESOURCE, { method }),
      );
      expect(bare.status).toBe(401);
      const authed = await route[method as 'GET'](
        new Request(RESOURCE, {
          method,
          headers: { authorization: `Bearer ${t}` },
        }),
      );
      expect(authed.status).toBe(405);
    }
  });

  it('off or not listed: 404', async () => {
    const off = createMcpRoute({
      getConfig: () => ({ enabled: false } as never),
      deps: () => deps,
    });
    expect((await off.POST(post())).status).toBe(404);
    const unlisted = createMcpRoute({
      getConfig: () =>
        ({ ...config, resources: ['http://localhost:3000/api/v2'] } as never),
      deps: () => deps,
    });
    expect((await unlisted.POST(post())).status).toBe(404);
  });
});

describe('MCP route: the tool answers for the token person', () => {
  it('A gets A, B gets B, never mixed; response is not cacheable', async () => {
    seen.length = 0;
    const a = await route.POST(post(await token({ sub: A })));
    const b = await route.POST(post(await token({ sub: B })));
    expect(a.status).toBe(200);
    expect(a.headers.get('cache-control')).toBe('no-store');
    const bodyA = JSON.parse((await a.json()).result.content[0].text);
    const bodyB = JSON.parse((await b.json()).result.content[0].text);
    expect(bodyA.for.slug).toBe('ada');
    expect(bodyB.for.slug).toBe('bob');
    expect(seen).toEqual(['ada@hypha', 'bob@hypha']);
  });

  it('a person with a profile missing gets a clear error', async () => {
    const lonely = {
      ...config,
      allowedPersonIds: new Set(['did:privy:new']),
    } as unknown as AuthServerConfig;
    const r = createMcpRoute({
      getConfig: () => lonely,
      deps: () => deps,
      keys: async () => publicKey,
    });
    const res = await r.POST(post(await token({ sub: 'did:privy:new' })));
    const out = await res.json();
    expect(out.result.isError).toBe(true);
    expect(JSON.parse(out.result.content[0].text).error).toBe(
      'profile_required',
    );
  });

  it('never echoes the token or the wallet address', async () => {
    const t = await token();
    const res = await route.POST(post(t));
    const text = await res.text();
    expect(text).not.toContain(t);
    expect(text).not.toContain('0xaaa');
    expect(JSON.stringify([...res.headers])).not.toContain(t);
  });
});

describe('protected-resource metadata', () => {
  it('names the resource, the issuer and the scope; public and uncached', async () => {
    const res = await route.metadata(new Request(METADATA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: ['spaces:read'],
      bearer_methods_supported: ['header'],
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
