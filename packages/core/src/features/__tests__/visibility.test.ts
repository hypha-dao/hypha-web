import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Category `visibility` (MCP test list): for each feature function, the four caller
 * relations (non-member, member, delegate, organisation sibling), a space without an
 * on-chain id, an item of another space, per-space grants, aggregates after the gate, and
 * fail closed on a chain-read failure. The access policy, the gate and the viewer rule are
 * REAL here; only chain reads, the database and the space modules are faked.
 */

vi.mock('server-only', () => ({}));

const dbRows = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@hypha-platform/storage-postgres', () => ({
  spaces: { id: 'id', parentId: 'parentId', web3SpaceId: 'web3SpaceId' },
}));

const chain = vi.hoisted(() => ({
  readChainClock: vi.fn(),
  readSpaceVisibilityBatch: vi.fn(),
  readSpaceGovernanceBatch: vi.fn(),
  readMemberSpaceIds: vi.fn(),
  readDelegateSpaceIds: vi.fn(),
  readSpaceMembersBatch: vi.fn(),
  readDelegatorsBatch: vi.fn(),
  readMemberAndDelegate: vi.fn(),
}));
vi.mock('../../access/chain-reads', () => chain);

const isOnChainMemberOrDelegate = vi.fn();
vi.mock('../../space/server/is-on-chain-member-or-delegate', () => ({
  isOnChainMemberOrDelegate: (...a: unknown[]) =>
    isOnChainMemberOrDelegate(...a),
}));

const all = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('../../space/server/web3/get-all-spaces', () => ({
  getAllSpaces: vi.fn(async () => all.spaces),
}));
vi.mock('../../space/server/web3/get-spaces-by-slugs', () => ({
  getSpacesBySlugs: vi.fn(),
}));
vi.mock('../../space/server/web3/get-spaces-by-web3-ids', () => ({
  getSpacesByWeb3Ids: vi.fn(),
}));
vi.mock('../../space/utils', () => ({ isSpaceArchived: () => false }));

const hostFields = vi.hoisted(() => ({ bySlug: new Map<string, unknown>() }));
vi.mock('../../space/server/queries', () => ({
  findSpaceHostFieldsBySlug: vi.fn(
    async ({ slug }: { slug: string }) => hostFields.bySlug.get(slug) ?? null,
  ),
}));
vi.mock('../../people/server/queries', () => ({ findPersonBySub: vi.fn() }));

import { clearChainFactsCaches } from '../../access/viewer-access';
import { listSpaces } from '../list-spaces';
import { getMyMembership } from '../get-my-membership';

const ADDR = '0xabc0000000000000000000000000000000000001' as const;
const db = {
  select: () => ({ from: () => Promise.resolve(dbRows.rows) }),
} as never;
const via = (spaceGrants: number[] | null = null) => ({
  clientId: 'https://client.example/cimd.json',
  scopes: ['spaces:read'],
  spaceGrants,
});
const mcpUser = (grants: number[] | null = null) =>
  ({
    kind: 'user',
    person: { id: 1 },
    address: ADDR,
    via: via(grants),
  } as never);
const apiUser = { kind: 'user', person: { id: 1 }, address: ADDR } as never;

// DB ids 1-5 with web3 ids 1-5 and levels 0,1,2,3,2; DB id 6 has NO on-chain id.
// Organisation tree: DB 10 -> 11 (web3 3) and 12 (web3 6).
const spaceRow = (id: number, web3SpaceId: number | null) => ({
  id,
  slug: `s${id}`,
  title: `Space ${id}`,
  web3SpaceId,
  memberCount: 3,
});
const levelsOf = (map: Record<number, number>) =>
  new Map(
    Object.entries(map).map(([id, d]) => [
      Number(id),
      { discoverability: d, access: d },
    ]),
  );

beforeEach(() => {
  vi.clearAllMocks();
  clearChainFactsCaches();
  all.spaces = [
    spaceRow(1, 1),
    spaceRow(2, 2),
    spaceRow(3, 3),
    spaceRow(4, 4),
    spaceRow(5, 5),
    spaceRow(6, null),
  ];
  hostFields.bySlug = new Map(
    (
      all.spaces as { slug: string; id: number; web3SpaceId: number | null }[]
    ).map((s) => [s.slug, { id: s.id, web3SpaceId: s.web3SpaceId }]),
  );
  dbRows.rows = [
    { id: 10, parentId: null, web3SpaceId: 100 },
    { id: 11, parentId: 10, web3SpaceId: 3 },
    { id: 12, parentId: 10, web3SpaceId: 6 },
  ];
  chain.readChainClock.mockResolvedValue({
    nowSeconds: 1,
    asOf: '2026-11-19T00:00:00.000Z',
    asOfBlock: 7,
  });
  chain.readSpaceVisibilityBatch.mockResolvedValue(
    levelsOf({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 2 }),
  );
  chain.readSpaceGovernanceBatch.mockResolvedValue(new Map());
  chain.readMemberSpaceIds.mockResolvedValue([]);
  chain.readDelegateSpaceIds.mockResolvedValue([]);
  chain.readSpaceMembersBatch.mockResolvedValue(new Map());
  chain.readDelegatorsBatch.mockResolvedValue(new Map());
  chain.readMemberAndDelegate.mockResolvedValue({
    isMember: false,
    isDelegate: false,
  });
  isOnChainMemberOrDelegate.mockResolvedValue(false);
});

const listed = async (caller: unknown, input = {}) => {
  const r = await listSpaces(input, caller as never, { db });
  if (!r.ok) throw new Error(`unexpected failure ${r.code}`);
  return r.data;
};
const slugsOf = async (caller: unknown, input = {}) =>
  (await listed(caller, input)).items.map((s) => s.slug);

describe('visibility: list spaces', () => {
  it('non-member: public and network spaces only', async () => {
    expect(await slugsOf(mcpUser())).toEqual(['s1', 's2']);
  });

  it('member: also the spaces they belong to (space level and organisation level)', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4, 3]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([
        [4, { members: [ADDR], executor: '0xe4' }],
        [3, { members: [ADDR], executor: '0xe3' }],
      ]),
    );
    expect(await slugsOf(mcpUser())).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('delegate: counts only with a member delegator', async () => {
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await slugsOf(mcpUser())).toContain('s4');
    clearChainFactsCaches();
    chain.readDelegatorsBatch.mockResolvedValue(new Map([[4, ['0xstranger']]]));
    expect(await slugsOf(mcpUser())).not.toContain('s4');
  });

  it('organisation sibling: sees the organisation-level space, never the space-level one', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    const slugs = await slugsOf(mcpUser());
    expect(slugs).toContain('s3'); // same tree as web3 6
    expect(slugs).not.toContain('s5'); // another tree
    expect(slugs).not.toContain('s4'); // space level
  });

  it('a space without an on-chain id is never listed (fail closed)', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4, 3]);
    expect(await slugsOf(mcpUser())).not.toContain('s6');
  });

  it('grants: only the granted spaces, even if the person can see more', async () => {
    expect(await slugsOf(mcpUser([2]))).toEqual(['s2']);
    expect(await slugsOf(mcpUser([]))).toEqual([]);
    // a grant never widens what the person may see
    expect(await slugsOf(mcpUser([4]))).toEqual([]);
  });

  it('total and pages describe only what the caller may see (aggregates after the gate)', async () => {
    const data = await listed(mcpUser(), { paging: { offset: 0, limit: 1 } });
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(1);
  });

  it('governance is read only for the visible page', async () => {
    await listed(mcpUser(), { with: { governance: true } });
    expect(chain.readSpaceGovernanceBatch).toHaveBeenCalledWith([1, 2]);
  });

  it('keeps the list when the optional governance read is rejected (null per space)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readSpaceGovernanceBatch.mockRejectedValue(new Error('rpc'));
    const data = await listed(mcpUser(), { with: { governance: true } });
    expect(data.items.map((s) => s.slug)).toEqual(['s1', 's2']);
    expect(data.items.every((s) => s.governance === null)).toBe(true);
    expect(data.memberCountByWeb3Id.size).toBe(0);
  });

  it('fails closed when the access levels cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    const r = await listSpaces({}, mcpUser(), { db });
    expect(r).toMatchObject({ ok: false, code: 'access_check_failed' });
  });

  it('archived is the flag only: an empty space is not archived, and includeEmpty is its own switch', async () => {
    all.spaces = [
      { ...spaceRow(1, 1), memberCount: 0 }, // empty, not flagged
      { ...spaceRow(2, 2), flags: ['archived'] }, // flagged
      spaceRow(3, 3),
    ];
    const shown = async (input: object) =>
      (await slugsOf(mcpUser([1, 2, 3]), input)).sort();
    // the flag alone hides s2; the empty s1 stays (omitEmpty is a different switch)
    expect(await shown({ omitFlagArchived: true })).toEqual(['s1']);
    expect(await shown({ omitFlagArchived: true, omitEmpty: true })).toEqual(
      [],
    );
    expect(await shown({ omitEmpty: true })).toEqual(['s2']);
  });

  it('never returns wallet-address arrays', async () => {
    all.spaces = [{ ...spaceRow(1, 1), memberAddresses: [ADDR] }];
    const data = await listed(mcpUser());
    expect(JSON.stringify(data)).not.toContain('0x');
  });
});

describe('visibility: get my membership', () => {
  const ask = (slug: string, caller: unknown) =>
    getMyMembership({ spaceSlug: slug, caller: caller as never }, { db });

  it('a member of a space-level space: true (grant-aware caller passes the matrix)', async () => {
    isOnChainMemberOrDelegate.mockResolvedValue(true);
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: true,
      isDelegate: false,
    });
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: true,
      data: { isMember: true, isDelegate: false },
    });
  });

  it('a non-member of a public space: false/false, not a refusal', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: true,
      data: { isMember: false, isDelegate: false },
    });
  });

  it('a non-member of a space they cannot see: not found (same as unknown)', async () => {
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(await ask('nope', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(chain.readMemberAndDelegate).not.toHaveBeenCalled();
  });

  it('a space outside the grants: not found, no chain read', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(chain.readMemberAndDelegate).not.toHaveBeenCalled();
  });

  it('a space without an on-chain id fails closed for a grant-aware caller', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('the API caller keeps its answer for a space without an on-chain id (unchanged)', async () => {
    expect(await ask('s6', apiUser)).toMatchObject({
      ok: true,
      data: { isMember: null, isDelegate: null },
    });
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
  });

  it('a guest is refused', async () => {
    expect(await ask('s1', { kind: 'guest' })).toMatchObject({
      ok: false,
      code: 'unauthenticated',
    });
  });
});
