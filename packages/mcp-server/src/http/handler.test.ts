import { describe, expect, it, vi } from 'vitest';
import {
  handleMcpRequest,
  protectedResourceMetadata,
  bearerChallenge,
} from './handler';
import type { McpDeps, McpPerson } from './server';

const people: Record<string, McpPerson> = {
  'did:privy:a': {
    name: 'Ada',
    surname: 'Lovelace',
    slug: 'ada',
    address: '0xaaa',
  },
  'did:privy:b': { name: 'Bob', slug: 'bob', address: '0xbbb' },
};

function deps(): McpDeps & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    findPerson: async (sub) => people[sub] ?? null,
    readMembership: async ({ spaceSlug, person }) => {
      reads.push(`${person.slug}@${spaceSlug}`);
      return {
        ok: true,
        body: {
          isMember: person.slug === 'ada',
          isDelegate: false,
          asOf: 'now',
        },
      };
    },
  };
}

async function rpc(sub: string, d: McpDeps, body: unknown) {
  const res = await handleMcpRequest(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    }),
    sub,
    d,
  );
  return res.json() as Promise<any>;
}

const call = (spaceSlug: unknown, extra: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'my_space_membership', arguments: { spaceSlug, ...extra } },
});

describe('MCP http handler', () => {
  it('lists one tool without a person parameter', async () => {
    const out = await rpc('did:privy:a', deps(), {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    expect(out.result.tools).toHaveLength(1);
    expect(Object.keys(out.result.tools[0].inputSchema.properties)).toEqual([
      'spaceSlug',
    ]);
  });

  it('answers for the token person and says whose it is', async () => {
    const d = deps();
    const out = await rpc('did:privy:a', d, call('hypha'));
    const body = JSON.parse(out.result.content[0].text);
    expect(body.for).toEqual({ name: 'Ada Lovelace', slug: 'ada' });
    expect(body.isMember).toBe(true);
    expect(d.reads).toEqual(['ada@hypha']);
    expect(JSON.stringify(out)).not.toContain('0xaaa');
  });

  it("never returns person B's data to person A, even when A names B", async () => {
    const d = deps();
    const out = await rpc(
      'did:privy:a',
      d,
      call('hypha', { person: 'bob', sub: 'did:privy:b' }),
    );
    const body = JSON.parse(out.result.content[0].text);
    expect(body.for.slug).toBe('ada');
    expect(d.reads).toEqual(['ada@hypha']);
    const outB = await rpc('did:privy:b', d, call('hypha'));
    expect(JSON.parse(outB.result.content[0].text).for.slug).toBe('bob');
  });

  it('a person without a profile gets a clear error, not a guest answer', async () => {
    const d = deps();
    const out = await rpc('did:privy:nobody', d, call('hypha'));
    expect(out.result.isError).toBe(true);
    expect(JSON.parse(out.result.content[0].text).error).toBe(
      'profile_required',
    );
    expect(d.reads).toEqual([]);
  });

  it('passes a read failure on as a tool error', async () => {
    const d = deps();
    d.readMembership = vi.fn(async () => ({
      ok: false as const,
      status: 404,
      error: 'Space not found',
    }));
    const out = await rpc('did:privy:a', d, call('nope'));
    expect(out.result.isError).toBe(true);
    expect(JSON.parse(out.result.content[0].text).error).toBe(
      'Space not found',
    );
  });

  it('builds the metadata and challenge', () => {
    expect(
      protectedResourceMetadata({
        resource: 'http://localhost:3000/api/mcp',
        issuer: 'http://auth.localhost:3000',
        scopes: ['spaces:read'],
      }),
    ).toMatchObject({
      resource: 'http://localhost:3000/api/mcp',
      authorization_servers: ['http://auth.localhost:3000'],
    });
    expect(bearerChallenge('http://m', { error: 'invalid_token' })).toBe(
      'Bearer resource_metadata="http://m", error="invalid_token"',
    );
  });
});
