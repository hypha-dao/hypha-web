import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const gate = vi.fn();
vi.mock('../space-read-gate', () => ({
  authorizeSpaceRead: (...a: unknown[]) => gate(...a),
}));
vi.mock('../viewer-access', () => ({ filterSpacesForViewer: vi.fn() }));

import { decideSpaceAccess } from '../policy';

const db = {} as never;
const via = (spaceGrants: number[] | null) => ({
  clientId: 'c',
  scopes: ['spaces:read'],
  spaceGrants,
});
const mcp = (grants: number[] | null = null) =>
  ({ kind: 'user', person: {}, address: '0x1', via: via(grants) } as never);
const space = { id: 5, web3SpaceId: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true });
});

describe('AccessPolicy: decideSpaceAccess', () => {
  it('full when grants, on-chain id and the matrix all allow', async () => {
    expect(await decideSpaceAccess(space, mcp(), { db })).toEqual({
      outcome: 'full',
    });
  });

  it('none outside the grants, without asking the matrix', async () => {
    expect(await decideSpaceAccess(space, mcp([1, 2]), { db })).toMatchObject({
      outcome: 'none',
      failure: { code: 'not_found' },
    });
    expect(gate).not.toHaveBeenCalled();
  });

  it('an empty grant list grants nothing; null means no restriction', async () => {
    expect((await decideSpaceAccess(space, mcp([]), { db })).outcome).toBe(
      'none',
    );
    expect((await decideSpaceAccess(space, mcp(null), { db })).outcome).toBe(
      'full',
    );
    expect((await decideSpaceAccess(space, mcp([5]), { db })).outcome).toBe(
      'full',
    );
  });

  it('a grant-aware caller is refused a space with no on-chain id', async () => {
    const d = await decideSpaceAccess({ id: 5, web3SpaceId: null }, mcp(), {
      db,
    });
    expect(d.outcome).toBe('none');
    expect(gate).not.toHaveBeenCalled();
  });

  it('other callers keep the matrix verdict for a space with no on-chain id', async () => {
    const api = { kind: 'user', person: {}, address: '0x1' } as never;
    expect(
      (await decideSpaceAccess({ id: 5, web3SpaceId: null }, api, { db }))
        .outcome,
    ).toBe('full');
  });

  it('none carries the matrix failure (refused, or the check failed closed)', async () => {
    gate.mockResolvedValue({ ok: false, code: 'forbidden' });
    expect(await decideSpaceAccess(space, mcp(), { db })).toMatchObject({
      outcome: 'none',
      failure: { code: 'forbidden' },
    });
    gate.mockResolvedValue({ ok: false, code: 'access_check_failed' });
    expect(await decideSpaceAccess(space, mcp(), { db })).toMatchObject({
      outcome: 'none',
      failure: { code: 'access_check_failed' },
    });
  });

  it('never returns minimal in this release', async () => {
    for (const g of [null, [5], []] as const) {
      const d = await decideSpaceAccess(space, mcp(g as never), { db });
      expect(d.outcome).not.toBe('minimal');
    }
  });
});
