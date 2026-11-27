import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const findSpace = vi.fn();
// The data-access boundary is faked: no database, no query module.
vi.mock('../../data-access/spaces', () => ({
  findSpaceHostFieldsBySlug: (_request: unknown, ...a: unknown[]) =>
    findSpace(...a),
}));
const decide = vi.fn();
vi.mock('../../access/write-access', () => ({
  decideSpaceWrite: (...a: unknown[]) => decide(...a),
}));
const store = vi.fn();
vi.mock('../../data-access/signals', () => ({
  createSignalUnlessDuplicate: (...a: unknown[]) => store(...a),
}));

import { createSignal } from '../create-signal';
import { appOrigin, mcpClientOrigin, type Origin } from '../../origin';

type TestCaller = {
  via?: { clientId: string | null; clientName?: string | null };
};
/** The context the MCP edge builds: the caller and an AI client origin from its token. */
const ctx = (c: never, origin?: Origin) => {
  const via = (c as TestCaller).via;
  return {
    actor: c,
    origin:
      origin ??
      (via?.clientId
        ? mcpClientOrigin({
            clientId: via.clientId,
            clientName: via.clientName ?? null,
          })
        : appOrigin()),
  };
};
const run = (i: unknown, c: never, d: ReturnType<typeof deps>) =>
  createSignal(i as never, ctx(c), d);
const caller = (over: Record<string, unknown> = {}) =>
  ({
    kind: 'user',
    person: { id: 7 },
    address: '0x1',
    via: {
      clientId: 'https://client.example/meta.json',
      scopes: ['spaces:read', 'signals:write'],
      spaceGrants: null,
      clientName: 'Example AI',
    },
    ...over,
  } as never);
const input = {
  spaceSlug: 'alpha',
  type: 'Need' as const,
  title: '  Water  ',
  description: ' The well is dry. ',
  tags: ['water', 'Water', ' AI Signal ', 'urgent'],
};
const take = vi.fn();
const deps = () => ({ rateLimiter: { take } });

beforeEach(() => {
  vi.clearAllMocks();
  findSpace.mockResolvedValue({ id: 5, slug: 'alpha', web3SpaceId: 50 });
  decide.mockResolvedValue({ ok: true });
  take.mockReturnValue({ ok: true });
  store.mockImplementation(async (_ctx, signal) => ({
    duplicate: false,
    signal: {
      id: 99,
      slug: 'coh-abcd1234',
      type: signal.type,
      title: signal.title,
      description: signal.description,
      tags: signal.tags,
      createdAt: new Date('2026-11-27T10:00:00Z'),
      origin: { kind: 'mcp_client', clientLabel: 'Example AI' },
    },
  }));
});

describe('createSignal', () => {
  it('creates with the trimmed text, cleaned tags and the origin from the token', async () => {
    const r = await run(input, caller(), deps());
    expect(r).toEqual({
      ok: true,
      data: {
        id: 99,
        spaceId: 5,
        slug: 'coh-abcd1234',
        spaceSlug: 'alpha',
        type: 'Need',
        title: 'Water',
        description: 'The well is dry.',
        tags: ['water', 'urgent'],
        createdAt: '2026-11-27T10:00:00.000Z',
        duplicate: false,
        origin: { kind: 'mcp_client', clientLabel: 'Example AI' },
      },
    });
    const [written, signal, rule] = store.mock.calls[0]!;
    expect(signal).toEqual({
      spaceId: 5,
      creatorId: 7,
      type: 'Need',
      title: 'Water',
      description: 'The well is dry.',
      tags: ['water', 'urgent'],
    });
    expect(rule.windowSeconds).toBe(600);
    expect(rule.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(
      rule.sameContent({ title: 'WATER', description: 'the well  is dry.' }),
    ).toBe(true);
    expect(rule.sameContent({ title: 'Water', description: 'Other' })).toBe(
      false,
    );
    expect(written.origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'https://client.example/meta.json',
      clientLabel: 'Example AI',
    });
    expect(take).toHaveBeenCalledWith('signals.create:7');
  });

  it('asks the write rule with the signals:write scope', async () => {
    await run(input, caller(), deps());
    expect(decide).toHaveBeenCalledWith(
      { id: 5, slug: 'alpha', web3SpaceId: 50 },
      expect.objectContaining({ actor: expect.anything() }),
      { scope: 'signals:write' },
      { readMembership: undefined },
    );
  });

  it('a refusal of the write rule is returned as is, and spends no rate budget', async () => {
    decide.mockResolvedValue({ ok: false, code: 'forbidden', message: 'x' });
    expect(await run(input, caller(), deps())).toMatchObject({
      code: 'forbidden',
    });
    expect(take).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it('an unknown space is not found', async () => {
    findSpace.mockResolvedValue(null);
    expect(await run(input, caller(), deps())).toMatchObject({
      code: 'not_found',
    });
    expect(decide).not.toHaveBeenCalled();
  });

  it('rate limited: nothing written, and the retry time is passed on', async () => {
    take.mockReturnValue({ ok: false, retryAfterSeconds: 42 });
    expect(await run(input, caller(), deps())).toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 42,
    });
    expect(store).not.toHaveBeenCalled();
  });

  it('a duplicate is returned with duplicate: true', async () => {
    store.mockImplementation(async (_ctx, signal) => ({
      duplicate: true,
      signal: {
        id: 50,
        slug: 'coh-old',
        type: signal.type,
        title: signal.title,
        description: signal.description,
        tags: [],
        createdAt: new Date('2026-11-27T09:55:00Z'),
        origin: { kind: 'mcp_client', clientLabel: null },
      },
    }));
    const r = await run(input, caller(), deps());
    expect(r).toMatchObject({ ok: true, data: { id: 50, duplicate: true } });
  });

  it.each([
    ['an empty title', { title: '   ' }, 'title'],
    ['a long title', { title: 'x'.repeat(51) }, 'title'],
    ['a long description', { description: 'x'.repeat(4001) }, 'description'],
    ['an unknown type', { type: 'Trend' }, 'type'],
    [
      'too many tags',
      { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
      'tags',
    ],
    ['a long tag', { tags: ['x'.repeat(41)] }, 'tags'],
  ])('refuses %s without echoing it', async (_label, over, field) => {
    const r = await run({ ...input, ...(over as object) }, caller(), deps());
    expect(r).toMatchObject({ ok: false, code: 'invalid_input' });
    expect((r as { message: string }).message.toLowerCase()).toContain(field);
    expect(findSpace).not.toHaveBeenCalled();
  });

  it('refuses a caller without via, or a token without a client id', async () => {
    expect(
      await run(
        input,
        { kind: 'user', person: { id: 7 }, address: '0x1' } as never,
        deps(),
      ),
    ).toMatchObject({ code: 'unauthenticated' });
    const noClient = caller({
      via: { clientId: null, scopes: ['signals:write'], spaceGrants: null },
    });
    expect(await run(input, noClient, deps())).toMatchObject({
      code: 'forbidden',
    });
    expect(store).not.toHaveBeenCalled();
  });

  it('records no client name when the token carries none', async () => {
    const noName = caller({
      via: {
        clientId: 'hypha-cursor',
        scopes: ['signals:write'],
        spaceGrants: null,
      },
    });
    await run(input, noName, deps());
    expect(store.mock.calls[0]![0].origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'hypha-cursor',
      clientLabel: null,
    });
  });
  it('refuses an origin that does not match the caller, and writes nothing', async () => {
    const otherClient = mcpClientOrigin({ clientId: 'another-client' });
    expect(
      await createSignal(input, ctx(caller(), otherClient), deps()),
    ).toMatchObject({ ok: false, code: 'forbidden' });
    expect(
      await createSignal(input, ctx(caller(), appOrigin()), deps()),
    ).toMatchObject({ ok: false, code: 'forbidden' });
    expect(findSpace).not.toHaveBeenCalled();
    expect(take).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it('waits for an asynchronous rate limiter', async () => {
    take.mockResolvedValue({ ok: false, retryAfterSeconds: 60 });
    expect(await run(input, caller(), deps())).toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 60,
    });
    expect(store).not.toHaveBeenCalled();
  });
});
