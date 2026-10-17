import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const dbRows = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@hypha-platform/storage-postgres', () => ({
  spaces: { id: 'id', parentId: 'parentId', web3SpaceId: 'web3SpaceId' },
}));

const chain = vi.hoisted(() => ({
  readSpaceVisibilityBatch: vi.fn(),
  readMemberSpaceIds: vi.fn(),
  readDelegateSpaceIds: vi.fn(),
  readSpaceMembersBatch: vi.fn(),
  readDelegatorsBatch: vi.fn(),
}));
vi.mock('../chain-reads', () => chain);

import {
  clearChainFactsCaches,
  filterSpacesForViewer,
  relationsForSpaces,
} from '../viewer-access';
import { isLevelSatisfied } from '../../visibility-rule';

const ADDR = '0xabc0000000000000000000000000000000000001' as const;
const db = {
  select: () => ({ from: () => Promise.resolve(dbRows.rows) }),
} as never;
const guest = { kind: 'guest' } as const;
const user = { kind: 'user', person: { id: 1 }, address: ADDR } as never;

// web3 ids: 1 public, 2 network, 3 org, 4 space-only, 5 org (another tree)
const spaces = [1, 2, 3, 4, 5].map((id) => ({
  id,
  slug: `s${id}`,
  web3SpaceId: id,
}));
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
  // db tree: 10 root with children 11 (web3 3) and 12 (web3 6); the rest are roots
  dbRows.rows = [
    { id: 10, parentId: null, web3SpaceId: 100 },
    { id: 11, parentId: 10, web3SpaceId: 3 },
    { id: 12, parentId: 10, web3SpaceId: 6 },
    { id: 13, parentId: null, web3SpaceId: 5 },
    { id: 14, parentId: null, web3SpaceId: 4 },
    { id: 15, parentId: null, web3SpaceId: 1 },
    { id: 16, parentId: null, web3SpaceId: 2 },
  ];
  chain.readSpaceVisibilityBatch.mockResolvedValue(
    levelsOf({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 2 }),
  );
  chain.readMemberSpaceIds.mockResolvedValue([]);
  chain.readDelegateSpaceIds.mockResolvedValue([]);
  chain.readSpaceMembersBatch.mockResolvedValue(new Map());
  chain.readDelegatorsBatch.mockResolvedValue(new Map());
});

const slugs = async (caller: unknown) =>
  (await filterSpacesForViewer(spaces, caller as never, { db })).visible.map(
    (s) => s.slug,
  );

describe('filterSpacesForViewer (the viewer-aware list)', () => {
  it('guest: level 0 only; hidden spaces do not leak', async () => {
    expect(await slugs(guest)).toEqual(['s1']);
    // a guest triggers no per-viewer chain reads
    expect(chain.readMemberSpaceIds).not.toHaveBeenCalled();
  });

  it('signed-in non-member: levels 0 and 1', async () => {
    expect(await slugs(user)).toEqual(['s1', 's2']);
  });

  it('direct member: sees the level-3 space and the level-2 space they are in', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4, 3]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([
        [4, { members: [ADDR], executor: '0xexec4' }],
        [3, { members: [ADDR], executor: '0xexec3' }],
      ]),
    );
    expect(await slugs(user)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('delegate with a member delegator counts as direct; without one it does not', async () => {
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await slugs(user)).toContain('s4');

    clearChainFactsCaches();
    chain.readDelegatorsBatch.mockResolvedValue(new Map([[4, ['0xstranger']]]));
    expect(await slugs(user)).not.toContain('s4');
  });

  it('org sibling sees the level-2 space, not level 3, not another organisation', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]); // 6 is a sibling of 3 (root 10)
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xexec6' }]]),
    );
    const visible = await slugs(user);
    expect(visible).toContain('s3');
    expect(visible).not.toContain('s4');
    expect(visible).not.toContain('s5');
  });

  it('member of a member-space is org-level: sees level 2, never level 3', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([9]); // 9 executor is a member of 5 and 4
    chain.readSpaceMembersBatch.mockImplementation(async (ids: number[]) => {
      const all = new Map([
        [9, { members: [ADDR], executor: '0xmemberspace' }],
        [5, { members: ['0xmemberspace'], executor: '0xe5' }],
        [4, { members: ['0xmemberspace'], executor: '0xe4' }],
      ]);
      return new Map(
        ids.filter((i) => all.has(i)).map((i) => [i, all.get(i)!]),
      );
    });
    const visible = await slugs(user);
    expect(visible).toContain('s5'); // level 2 via the member-space
    expect(visible).not.toContain('s4'); // level 3 needs to be inside
  });

  it('unreadable level hides the space (fail closed)', async () => {
    chain.readSpaceVisibilityBatch.mockResolvedValue(levelsOf({ 1: 0 }));
    expect(await slugs(user)).toEqual(['s1']);
  });

  it('unreadable viewer facts: levels 0-1 only, never more', async () => {
    chain.readMemberSpaceIds.mockRejectedValue(new Error('rpc'));
    expect(await slugs(user)).toEqual(['s1', 's2']);
  });

  it('a space with no on-chain id is not listed', async () => {
    const r = await filterSpacesForViewer(
      [...spaces, { id: 99, slug: 'off', web3SpaceId: null }],
      guest,
      { db },
    );
    expect(r.visible.map((s) => s.slug)).not.toContain('off');
  });

  it('a user without a wallet address sees only level 0', async () => {
    const noAddr = { kind: 'user', person: { id: 1 }, address: null } as never;
    expect(await slugs(noAddr)).toEqual(['s1']);
  });
});

describe('cost and cache (chain facts)', () => {
  it('cold: one levels multicall and one set of viewer reads; warm: none', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: [ADDR], executor: '0xe' }]]),
    );
    await slugs(user);
    expect(chain.readSpaceVisibilityBatch).toHaveBeenCalledTimes(1);
    expect(chain.readMemberSpaceIds).toHaveBeenCalledTimes(1);
    expect(chain.readDelegateSpaceIds).toHaveBeenCalledTimes(1);

    await slugs(user);
    expect(chain.readSpaceVisibilityBatch).toHaveBeenCalledTimes(1);
    expect(chain.readMemberSpaceIds).toHaveBeenCalledTimes(1);
  });

  it('is not N reads per space: 5 spaces need one levels read', async () => {
    await slugs(user);
    expect(chain.readSpaceVisibilityBatch).toHaveBeenCalledTimes(1);
    expect(chain.readSpaceVisibilityBatch.mock.calls[0]![0]).toHaveLength(5);
  });
});

describe('relationsForSpaces', () => {
  it('guest: no relation and no chain reads', async () => {
    const r = await relationsForSpaces(guest, [3], () => 2, { db });
    expect(r.get(3)).toMatchObject({ signedIn: false, direct: false });
    expect(chain.readMemberSpaceIds).not.toHaveBeenCalled();
  });
});

describe('isLevelSatisfied (pure rule)', () => {
  const base = {
    signedIn: true,
    direct: false,
    orgSibling: false,
    memberSpaceParticipant: false,
  };
  it('matrix', () => {
    expect(isLevelSatisfied(0, { ...base, signedIn: false })).toBe(true);
    expect(isLevelSatisfied(1, { ...base, signedIn: false })).toBe(false);
    expect(isLevelSatisfied(1, base)).toBe(true);
    expect(isLevelSatisfied(2, base)).toBe(false);
    expect(isLevelSatisfied(2, { ...base, memberSpaceParticipant: true })).toBe(
      true,
    );
    expect(isLevelSatisfied(3, { ...base, memberSpaceParticipant: true })).toBe(
      false,
    );
    expect(isLevelSatisfied(3, { ...base, orgSibling: true })).toBe(false);
    expect(isLevelSatisfied(3, { ...base, direct: true })).toBe(true);
    expect(isLevelSatisfied(undefined, { ...base, direct: true })).toBe(false);
    expect(isLevelSatisfied(7, { ...base, direct: true })).toBe(false);
  });
});
