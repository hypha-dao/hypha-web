import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet } from 'jose';
import * as h from '../../../../../../packages/auth-server/src/testing/harness';
import type { McpDeps } from '@hypha-platform/mcp-server/http';
import { createMcpRoute } from '../mcp-route';

/**
 * temp(mcp) #2559: the real authorization server issues the token, the MCP route accepts it.
 * Needs the throwaway database: set AUTH_SERVER_TEST_DATABASE_URL in the process environment
 * (skipped otherwise). Run: pnpm --filter web exec vitest run src/lib/mcp/__tests__/mcp-as
 */
const run = h.TEST_DB_URL ? describe : describe.skip;

const MCP = 'http://localhost:3000/api/mcp';
const V2 = 'http://localhost:3000/api/v2';
const SECRET = 'contract-test-secret-'.padEnd(48, 'x');
const OVER = {
  AUTH_SERVER_SECRET: SECRET,
  AUTH_SERVER_RESOURCES: `${MCP},${V2}`,
};

const deps: McpDeps = {
  findPerson: async (sub) => ({ name: 'Test', slug: sub.replace(/\W/g, '') }),
  readMembership: async () => ({
    ok: true,
    body: { isMember: true, isDelegate: false, asOf: 'now' },
  }),
};

run('MCP route with tokens from the real authorization server', () => {
  let s: h.Harness;
  beforeAll(async () => {
    s = await h.makeServer(OVER);
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON, h.OTHER_PERSON]);
  });
  afterAll(async () => {
    await s.pool.end();
  });

  async function route() {
    const jwks = await s.handler(h.req('/api/auth/jwks.json'));
    return createMcpRoute({
      getConfig: () => h.testConfig(OVER),
      deps: () => deps,
      keys: createLocalJWKSet(await jwks.json()) as never,
    });
  }
  const list = (bearer: string) =>
    new Request(MCP, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

  it('accepts a token issued for the MCP resource and answers for its person', async () => {
    const f = await h.fullFlow(s, { resource: MCP });
    expect(f.stage).toBe('done');
    const res = await (
      await route()
    ).POST(list(f.token!.body.access_token as string));
    expect(res.status).toBe(200);
    expect((await res.json()).result.tools[0].name).toBe('my_space_membership');
  });

  it('refuses a token issued for the API v2 resource', async () => {
    const f = await h.fullFlow(s, { resource: V2 });
    expect(f.stage).toBe('done');
    const res = await (
      await route()
    ).POST(list(f.token!.body.access_token as string));
    expect(res.status).toBe(401);
  });

  it('refuses a token whose scope lacks spaces:read', async () => {
    const f = await h.fullFlow(s, {
      resource: MCP,
      scope: 'offline_access',
    });
    if (f.stage !== 'done') return; // the server may refuse to issue it at all: also fine
    const res = await (
      await route()
    ).POST(list(f.token!.body.access_token as string));
    expect(res.status).toBe(403);
  });
});
