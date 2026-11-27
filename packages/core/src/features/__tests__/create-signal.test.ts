import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const findSpace = vi.fn();
vi.mock('../../space/server/queries', () => ({
  findSpaceHostFieldsBySlug: (...a: unknown[]) => findSpace(...a),
}));
const decide = vi.fn();
vi.mock('../../access/write-access', () => ({
  decideSpaceWrite: (...a: unknown[]) => decide(...a),
}));
const store = vi.fn();
vi.mock('../../coherence/server/signal-write-store', () => ({
  createSignalUnlessDuplicate: (...a: unknown[]) => store(...a),
}));

import { createSignal } from '../create-signal';

const db = {} as never;
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
const deps = () => ({ db, rateLimiter: { take } });

beforeEach(() => {
  vi.clearAllMocks();
  findSpace.mockResolvedValue({ id: 5, slug: 'alpha', web3SpaceId: 50 });
  decide.mockResolvedValue({ ok: true });
  take.mockReturnValue({ ok: true });
  store.mockImplementation(async (signal) => ({
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
    const r = await createSignal(input, caller(), deps());
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
    const [signal, rule, config] = store.mock.calls[0]!;
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
    expect(config.origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'https://client.example/meta.json',
      clientLabel: 'Example AI',
    });
    expect(take).toHaveBeenCalledWith('signals.create:7');
  });

  it('asks the write rule with the signals:write scope', async () => {
    await createSignal(input, caller(), deps());
    expect(decide).toHaveBeenCalledWith(
      { id: 5, slug: 'alpha', web3SpaceId: 50 },
      expect.anything(),
      { scope: 'signals:write' },
      expect.objectContaining({ db }),
    );
  });

  it('a refusal of the write rule is returned as is, and spends no rate budget', async () => {
    decide.mockResolvedValue({ ok: false, code: 'forbidden', message: 'x' });
    expect(await createSignal(input, caller(), deps())).toMatchObject({
      code: 'forbidden',
    });
    expect(take).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it('an unknown space is not found', async () => {
    findSpace.mockResolvedValue(null);
    expect(await createSignal(input, caller(), deps())).toMatchObject({
      code: 'not_found',
    });
    expect(decide).not.toHaveBeenCalled();
  });

  it('rate limited: nothing written, and the retry time is passed on', async () => {
    take.mockReturnValue({ ok: false, retryAfterSeconds: 42 });
    expect(await createSignal(input, caller(), deps())).toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 42,
    });
    expect(store).not.toHaveBeenCalled();
  });

  it('a duplicate is returned with duplicate: true', async () => {
    store.mockImplementation(async (signal) => ({
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
    const r = await createSignal(input, caller(), deps());
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
    const r = await createSignal(
      { ...input, ...(over as object) } as never,
      caller(),
      deps(),
    );
    expect(r).toMatchObject({ ok: false, code: 'invalid_input' });
    expect((r as { message: string }).message.toLowerCase()).toContain(field);
    expect(findSpace).not.toHaveBeenCalled();
  });

  it('refuses a caller without via, or a token without a client id', async () => {
    expect(
      await createSignal(
        input,
        { kind: 'user', person: { id: 7 }, address: '0x1' } as never,
        deps(),
      ),
    ).toMatchObject({ code: 'unauthenticated' });
    const noClient = caller({
      via: { clientId: null, scopes: ['signals:write'], spaceGrants: null },
    });
    expect(await createSignal(input, noClient, deps())).toMatchObject({
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
    await createSignal(input, noName, deps());
    expect(store.mock.calls[0]![2].origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'hypha-cursor',
      clientLabel: null,
    });
  });
});
