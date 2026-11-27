import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Category `visibility` (MCP test list): for each feature function, the four caller
 * relations (non-member, member, delegate, organisation sibling), a space without an
 * on-chain id, an item of another space, per-space grants, aggregates after the gate, and
 * fail closed on a chain-read failure. The access policy, the gate and the viewer rule are
 * REAL here; only chain reads and the data-access boundary (#2745) are faked.
 */

vi.mock('server-only', () => ({}));

const dbRows = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('../../data-access/organisation', () => ({
  readSpaceTree: async () => dbRows.rows,
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
  readProposalOutcomeIds: vi.fn(),
  readProposalCoreBatch: vi.fn(),
  readIsProposalWithdrawn: vi.fn(),
  readProposalVoters: vi.fn(),
}));
vi.mock('../../access/chain-reads', () => chain);

const proposalRows = vi.hoisted(() => ({
  bySpaceId: new Map<number, unknown[]>(),
}));
const findProposalDocumentsPage = vi.hoisted(() => vi.fn());
const findProposalVoteRefBySlug = vi.hoisted(() => vi.fn());
const voteRefs = vi.hoisted(() => ({
  bySpaceAndSlug: new Map<string, unknown>(),
}));
// The spies keep the data function's argument order: (input, request).
vi.mock('../../data-access/proposals', () => ({
  findProposalDocumentsPage: (request: unknown, input: unknown) =>
    findProposalDocumentsPage(input, request),
  findProposalVoteRefBySlug: (request: unknown, input: unknown) =>
    findProposalVoteRefBySlug(input, request),
}));
const memberPower = vi.hoisted(() => vi.fn());
vi.mock('../../coherence/server/web3/get-member-voting-power', () => ({
  getMemberVotingPower: memberPower,
}));

const quests = vi.hoisted(() => ({
  list: vi.fn(),
  docs: vi.fn(),
  activate: vi.fn(),
}));
vi.mock('../../data-access/quests', () => ({
  readQuestsListing: quests.list,
  selectQuestProposalDocuments: quests.docs,
}));
// the feature must never reach a write path: this spy has to stay uncalled
vi.mock('../../space-quests/server/mutations', () => ({
  activateSpaceQuestByDocumentId: quests.activate,
}));

const sig = vi.hoisted(() => ({
  page: vi.fn(),
  count: vi.fn(),
  summary: vi.fn(),
  tags: vi.fn(),
  upvotes: vi.fn(),
  names: vi.fn(),
  symbols: vi.fn(),
}));
vi.mock('../../data-access/signals', () => ({
  readSignalWorkflowConfig: vi.fn(async () => ({
    statuses: [
      {
        slug: 'backlog',
        name: 'Backlog',
        color: 'neutral',
        category: 'backlog',
        position: 0,
      },
    ],
    boards: [
      { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    ],
  })),
  selectSignalsPage: sig.page,
  countSignals: sig.count,
  summariseSignals: sig.summary,
  selectTopSignalTags: sig.tags,
  selectSignalUpvotes: sig.upvotes,
  selectPersonDisplayNames: sig.names,
  selectTokenSymbolsByAddress: sig.symbols,
}));

const isOnChainMemberOrDelegate = vi.fn();
vi.mock('../../space/server/is-on-chain-member-or-delegate', () => ({
  isOnChainMemberOrDelegate: (...a: unknown[]) =>
    isOnChainMemberOrDelegate(...a),
}));

const all = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('../../space/utils', () => ({ isSpaceArchived: () => false }));

const hostFields = vi.hoisted(() => ({
  bySlug: new Map<string, unknown>(),
  full: new Map<string, unknown>(),
}));
vi.mock('../../data-access/spaces', () => ({
  listAllSpaces: vi.fn(async () => all.spaces),
  listSpacesBySlugs: vi.fn(),
  listSpacesByWeb3Ids: vi.fn(),
  findSpaceHostFieldsBySlug: vi.fn(
    async (_request: unknown, { slug }: { slug: string }) =>
      hostFields.bySlug.get(slug) ?? null,
  ),
  findSpaceWithSubspacesBySlug: vi.fn(
    async (_request: unknown, { slug }: { slug: string }) =>
      hostFields.full.get(slug) ?? null,
  ),
  findSpaceById: vi.fn(
    async (_request: unknown, { id }: { id: number }) =>
      [...hostFields.full.values()].find(
        (row) => (row as { id: number }).id === id,
      ) ?? null,
  ),
}));
vi.mock('../../data-access/people', () => ({ findPersonBySub: vi.fn() }));

import { clearChainFactsCaches } from '../../access/viewer-access';
import { listSpaces } from '../list-spaces';
import { getMyMembership } from '../get-my-membership';
import { getSpace } from '../get-space';
import { listProposals } from '../list-proposals';
import { getMyVote } from '../get-my-vote';
import { listSignals } from '../list-signals';
import { listQuests } from '../list-quests';

const ADDR = '0xabc0000000000000000000000000000000000001' as const;
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
  const r = await listSpaces(input, { actor: caller as never });
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
    const r = await listSpaces({}, { actor: mcpUser() });
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

  describe('mine', () => {
    const memberOf = (...ids: number[]) => {
      chain.readMemberSpaceIds.mockResolvedValue(ids);
      chain.readSpaceMembersBatch.mockResolvedValue(
        new Map(ids.map((id) => [id, { members: [ADDR], executor: '0xe' }])),
      );
    };

    it('returns the spaces the person is a member of, and only those', async () => {
      memberOf(1, 4);
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual(['s1', 's4']);
      // without the switch the list is unchanged (public, network, plus their space-level space)
      expect(await slugsOf(mcpUser())).toEqual(['s1', 's2', 's4']);
    });

    it('includes a space where the person is a delegate with a member delegator', async () => {
      memberOf(1);
      chain.readDelegateSpaceIds.mockResolvedValue([2]);
      chain.readSpaceMembersBatch.mockResolvedValue(
        new Map([
          [1, { members: [ADDR], executor: '0xe' }],
          [2, { members: ['0xdelegator'], executor: '0xe2' }],
        ]),
      );
      chain.readDelegatorsBatch.mockResolvedValue(
        new Map([[2, ['0xdelegator']]]),
      );
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual(['s1', 's2']);
    });

    it('excludes a delegate whose delegator is not a member, and spaces where only another person is a member', async () => {
      chain.readDelegateSpaceIds.mockResolvedValue([2]);
      chain.readSpaceMembersBatch.mockResolvedValue(
        new Map([[2, { members: ['0xother'], executor: '0xe2' }]]),
      );
      chain.readDelegatorsBatch.mockResolvedValue(
        new Map([[2, ['0xstranger']]]),
      );
      // s1 and s2 are visible to the person; another person is a member of s2
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual([]);
      expect(await slugsOf(mcpUser())).toEqual(['s1', 's2']);
    });

    it('never lists a space the policy hides, even when the person is a member', async () => {
      memberOf(1, 4);
      // a grant to s1 only: s4 stays hidden although it is theirs
      expect(await slugsOf(mcpUser([1]), { mine: true })).toEqual(['s1']);
      // an unreadable level hides the space as well
      clearChainFactsCaches();
      chain.readSpaceVisibilityBatch.mockResolvedValue(
        levelsOf({ 1: 0, 2: 1, 3: 2, 5: 2 }),
      );
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual(['s1']);
      // a member id the list does not contain adds nothing
      clearChainFactsCaches();
      memberOf(1, 99);
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual(['s1']);
    });

    it('combines with the archived and empty switches and with ordering', async () => {
      all.spaces = [
        spaceRow(1, 1),
        { ...spaceRow(2, 2), flags: ['archived'] },
        { ...spaceRow(4, 4), memberCount: 0 },
      ];
      memberOf(1, 2, 4);
      const shown = (input: object) =>
        slugsOf(mcpUser(), { mine: true, ...input });
      expect(await shown({})).toEqual(['s1', 's2', 's4']);
      expect(await shown({ omitFlagArchived: true })).toEqual(['s1', 's4']);
      expect(await shown({ omitFlagArchived: true, omitEmpty: true })).toEqual([
        's1',
      ]);
      expect(await shown({ titleOrder: 'desc' })).toEqual(['s4', 's2', 's1']);
    });

    it('total and the offset cursor describe the narrowed set across pages', async () => {
      memberOf(1, 2, 4);
      const page = (offset: number) =>
        listed(mcpUser(), { mine: true, paging: { offset, limit: 2 } });
      const first = await page(0);
      expect(first.total).toBe(3);
      expect(first.items.map((s) => s.slug)).toEqual(['s1', 's2']);
      const second = await page(2);
      expect(second.total).toBe(3);
      expect(second.items.map((s) => s.slug)).toEqual(['s4']);
    });

    it('reads the membership once for the whole list, not once per space', async () => {
      memberOf(1, 4);
      await listed(mcpUser(), { mine: true });
      expect(chain.readMemberSpaceIds).toHaveBeenCalledTimes(1);
      expect(chain.readDelegateSpaceIds).toHaveBeenCalledTimes(1);
      expect(chain.readMemberAndDelegate).not.toHaveBeenCalled();
    });

    it('fails the call when the membership cannot be read (never an empty list)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      chain.readMemberSpaceIds.mockRejectedValue(new Error('rpc'));
      expect(
        await listSpaces({ mine: true }, { actor: mcpUser() }),
      ).toMatchObject({ ok: false, code: 'access_check_failed' });
    });

    it('with authoritative, fails instead of under-reporting when a delegate space cannot be read', async () => {
      memberOf(1);
      chain.readDelegateSpaceIds.mockResolvedValue([2]);
      // the batch reads drop the failed space: no entry at all (not an empty list)
      chain.readSpaceMembersBatch.mockResolvedValue(
        new Map([[1, { members: [ADDR], executor: '0xe' }]]),
      );
      chain.readDelegatorsBatch.mockResolvedValue(new Map());
      const strict = { mine: true, authoritative: true };
      expect(await listSpaces(strict, { actor: mcpUser() })).toMatchObject({
        ok: false,
        code: 'access_check_failed',
      });
      // authoritative is its own switch: it fails the plain list too
      expect(
        await listSpaces({ authoritative: true }, { actor: mcpUser() }),
      ).toMatchObject({ ok: false, code: 'access_check_failed' });
      // without it, mine filters what could be read (the filter and the guarantee are separate)
      expect(await slugsOf(mcpUser(), { mine: true })).toEqual(['s1']);
      // the plain list is not affected by the incomplete delegate read
      expect(await slugsOf(mcpUser())).toEqual(['s1', 's2']);
    });

    it('an explicit empty delegator list is a valid non-membership, not a failure', async () => {
      memberOf(1);
      chain.readDelegateSpaceIds.mockResolvedValue([2]);
      chain.readSpaceMembersBatch.mockResolvedValue(
        new Map([
          [1, { members: [ADDR], executor: '0xe' }],
          [2, { members: ['0xother'], executor: '0xe2' }],
        ]),
      );
      chain.readDelegatorsBatch.mockResolvedValue(new Map([[2, []]]));
      expect(
        await slugsOf(mcpUser(), { mine: true, authoritative: true }),
      ).toEqual(['s1']);
    });

    it('needs a verified user with a wallet address', async () => {
      expect(
        await listSpaces({ mine: true }, { actor: { kind: 'guest' } as never }),
      ).toMatchObject({ ok: false, code: 'unauthenticated' });
      const noAddress = {
        kind: 'user',
        person: { id: 1 },
        address: null,
        via: via(),
      } as never;
      expect(
        await listSpaces({ mine: true }, { actor: noAddress }),
      ).toMatchObject({ ok: false, code: 'invalid_identity' });
    });

    it('keeps the visible spaces for resolving a parent slug', async () => {
      memberOf(4);
      const data = await listed(mcpUser(), { mine: true });
      expect(data.items.map((s) => s.slug)).toEqual(['s4']);
      expect([...data.slugById.values()].sort()).toEqual(['s1', 's2', 's4']);
    });

    it('output contains no wallet address', async () => {
      all.spaces = [{ ...spaceRow(1, 1), memberAddresses: [ADDR] }];
      memberOf(1);
      const data = await listed(mcpUser(), { mine: true });
      expect(data.items).toHaveLength(1);
      expect(JSON.stringify(data.items)).not.toContain('0x');
    });
  });
});

describe('visibility: get my membership', () => {
  const ask = (slug: string, caller: unknown) =>
    getMyMembership({ spaceSlug: slug }, { actor: caller as never });

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

describe('visibility: get space', () => {
  const ask = (slug: string, caller: unknown, blocks = {}) =>
    getSpace({ slug, with: blocks }, { actor: caller as never });
  const ALL = { governance: true, visibility: true, counts: true };

  beforeEach(() => {
    hostFields.full = new Map(
      (all.spaces as { slug: string }[]).map((s) => [
        s.slug,
        {
          ...s,
          subspaces: [],
          members: [{ id: 9, address: ADDR }],
          documents: [{ id: 5, title: 'secret', state: 'discussion' }],
          memberAddresses: [ADDR],
          address: ADDR,
          chatRoomId: '!room:example',
        },
      ]),
    );
    chain.readSpaceGovernanceBatch.mockResolvedValue(
      new Map([
        [
          1,
          {
            quorum: 40,
            unity: 70,
            votingPowerSource: 2,
            joinMethod: 0,
            exitMethod: 0,
            memberCount: 5,
          },
        ],
      ]),
    );
  });

  it('non-member: public and network spaces only; a space-level space is not found', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s2', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s3', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('member and delegate: also the space they belong to', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: [ADDR], executor: '0xe4' }]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
    clearChainFactsCaches();
    chain.readMemberSpaceIds.mockResolvedValue([]);
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
  });

  it('organisation sibling: sees the organisation-level space, never the space-level one', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    expect(await ask('s3', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: false });
  });

  it('a space without an on-chain id is closed', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('grants: a space outside them is not found', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(await ask('s2', mcpUser([2]))).toMatchObject({ ok: true });
  });

  it('a slug that resolves to another space on the second read is not found', async () => {
    // the policy decided on s1 (id 1); the content read returns a different space
    hostFields.full.set('s1', {
      ...(hostFields.full.get('s1') as object),
      id: 99,
    });
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('an unknown slug and a hidden space give the same answer', async () => {
    expect(await ask('nope', mcpUser())).toEqual(await ask('s4', mcpUser()));
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
  });

  it('sub-spaces are filtered per caller before they leave the feature', async () => {
    hostFields.full.set('s1', {
      ...(hostFields.full.get('s1') as object),
      subspaces: [spaceRow(2, 2), spaceRow(4, 4), spaceRow(6, null)],
    });
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    // s2 is network level (visible); s4 is space level; s6 has no on-chain id
    expect(r.data.subspaces.map((s) => s.slug)).toEqual(['s2']);
  });

  it('a parent the caller cannot see is reported as no parent', async () => {
    hostFields.full.set('s1', {
      ...(hostFields.full.get('s1') as object),
      parentId: 4, // space level: not visible to this caller
    });
    hostFields.full.set('s2', {
      ...(hostFields.full.get('s2') as object),
      parentId: 1, // public: visible
    });
    const hidden = await ask('s1', mcpUser());
    const shown = await ask('s2', mcpUser());
    if (!hidden.ok || !shown.ok) throw new Error('unexpected');
    expect(hidden.data.parentSlug).toBeNull();
    expect(shown.data.parentSlug).toBe('s1');
  });

  it('never returns wallet addresses, member rows, documents or the chat room', async () => {
    hostFields.full.set('s1', {
      ...(hostFields.full.get('s1') as object),
      subspaces: [
        { ...spaceRow(2, 2), memberAddresses: [ADDR], address: ADDR },
      ],
    });
    const r = await ask('s1', mcpUser(), ALL);
    if (!r.ok) throw new Error('unexpected');
    const text = JSON.stringify(r.data);
    expect(text).not.toContain('0x');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('!room');
    expect(r.data).not.toHaveProperty('members');
    expect(r.data).not.toHaveProperty('documents');
  });

  it('adds only the requested blocks; the count comes from the chain read', async () => {
    const bare = await ask('s1', mcpUser());
    if (!bare.ok) throw new Error('unexpected');
    expect(bare.data).not.toHaveProperty('counts');
    expect(bare.data).not.toHaveProperty('governance');
    const r = await ask('s1', mcpUser(), ALL);
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.counts).toEqual({ memberCount: 5 });
    expect(r.data.visibility).toEqual({ discoverability: 0, access: 0 });
    expect(r.data.governance).toEqual({
      quorum: 40,
      unity: 70,
      votingPowerSource: 2,
      joinMethod: 0,
      exitMethod: 0,
    });
  });

  it('reports an unknown count as null, never a silent 0', async () => {
    chain.readSpaceGovernanceBatch.mockResolvedValue(new Map());
    const r = await ask('s1', mcpUser(), ALL);
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.counts).toEqual({ memberCount: null });
    expect(r.data.governance).toBeNull();
  });

  it('keeps the checked space with null blocks when an optional chain read is rejected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readSpaceGovernanceBatch.mockRejectedValue(new Error('rpc'));
    const r = await ask('s1', mcpUser(), ALL);
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.slug).toBe('s1');
    expect(r.data.governance).toBeNull();
    expect(r.data.counts).toEqual({ memberCount: null });
  });
});

describe('visibility: list proposals', () => {
  const doc = (over: Record<string, unknown> = {}) => ({
    id: 1,
    slug: 'p1',
    title: 'A proposal',
    state: 'proposal',
    label: '',
    web3ProposalId: 10,
    createdAt: new Date(1000),
    creator: {
      name: 'Ada',
      surname: 'L',
      type: 'person',
      avatarUrl: 'https://x/a.png',
      address: ADDR,
    },
    ...over,
  });
  const ask = (
    slug: string,
    caller: unknown,
    extra: Record<string, unknown> = {},
  ) =>
    listProposals(
      { spaceSlug: slug, paging: { offset: 0, limit: 20 }, ...extra },
      { actor: caller as never },
    );

  beforeEach(() => {
    proposalRows.bySpaceId = new Map([
      [1, [doc()]],
      [4, [doc({ slug: 'secret', title: 'secret' })]],
      [6, [doc({ slug: 'orphan', web3ProposalId: null })]],
    ]);
    findProposalDocumentsPage.mockImplementation(
      async ({ spaceId }: { spaceId: number }) => {
        const data = proposalRows.bySpaceId.get(spaceId) ?? [];
        return { data, total: data.length };
      },
    );
    chain.readProposalOutcomeIds.mockResolvedValue({
      accepted: new Set([10]),
      rejected: new Set(),
      withdrawn: new Set(),
    });
    chain.readProposalCoreBatch.mockResolvedValue(new Map());
  });

  it('non-member: a public space is listed, a space-level space is not found and nothing is read', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: true });
    findProposalDocumentsPage.mockClear();
    chain.readProposalOutcomeIds.mockClear();
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    // the policy answers before any content is fetched
    expect(findProposalDocumentsPage).not.toHaveBeenCalled();
    expect(chain.readProposalOutcomeIds).not.toHaveBeenCalled();
  });

  it('member and delegate: also the space they belong to', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: [ADDR], executor: '0xe4' }]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
    clearChainFactsCaches();
    chain.readMemberSpaceIds.mockResolvedValue([]);
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
  });

  it('organisation sibling: the organisation-level space, never the space-level one', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    expect(await ask('s3', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: false });
  });

  it('a space without an on-chain id is closed (and its rows are never read)', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(findProposalDocumentsPage).not.toHaveBeenCalled();
  });

  it('grants: a space outside them is not found', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(findProposalDocumentsPage).not.toHaveBeenCalled();
  });

  it('only the rows of the asked space are queried (an item of another space never appears)', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(findProposalDocumentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: 1 }),
      expect.anything(),
    );
    expect(r.data.items.map((i) => i.slug)).toEqual(['p1']);
    expect(JSON.stringify(r.data)).not.toContain('secret');
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
  });

  it('a status that cannot be read fails the call, never a list without status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readProposalOutcomeIds.mockRejectedValue(new Error('rpc'));
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: false,
      code: 'chain_read_failed',
    });
  });

  it('asks for proposals and agreements only, never discussions or memory entries', async () => {
    await ask('s1', mcpUser());
    await ask('s1', mcpUser(), { state: 'agreement' });
    const states = findProposalDocumentsPage.mock.calls.map(
      (c) => (c[0] as { states: string[] }).states,
    );
    expect(states).toEqual([['proposal', 'agreement'], ['agreement']]);
  });

  it('a Quest-labelled document comes back with its label (V15)', async () => {
    proposalRows.bySpaceId.set(1, [
      doc({ slug: 'q1', label: 'Quest', state: 'proposal' }),
      doc({ id: 2, slug: 'p2', label: '' }),
    ]);
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.items.map((i) => [i.slug, i.label])).toEqual([
      ['q1', 'Quest'],
      ['p2', null],
    ]);
  });

  it('status: from the chain outcomes; absent (null) only without an on-chain proposal id', async () => {
    proposalRows.bySpaceId.set(1, [
      doc({ slug: 'a', web3ProposalId: 10 }),
      doc({ id: 2, slug: 'b', web3ProposalId: 11 }),
      doc({ id: 3, slug: 'c', web3ProposalId: null }),
    ]);
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.items.map((i) => [i.slug, i.status])).toEqual([
      ['a', 'accepted'],
      ['b', 'onVoting'],
      ['c', null],
    ]);
  });

  it('the offset and the order are passed on; the default order is newest first', async () => {
    await ask('s1', mcpUser(), {
      paging: { offset: 40, limit: 20 },
      direction: 'asc',
    });
    expect(findProposalDocumentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 40, limit: 20, direction: 'asc' }),
      expect.anything(),
    );
    await ask('s1', mcpUser());
    expect(findProposalDocumentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: 'desc' }),
      expect.anything(),
    );
  });

  it('never returns a wallet address; the creator is display fields only', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(JSON.stringify(r.data)).not.toContain('0x');
    expect(r.data.items[0]!.creator).toEqual({
      name: 'Ada',
      surname: 'L',
      type: 'person',
    });
  });

  it('keeps the list when the optional tally reads are rejected (tally null per proposal)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readProposalCoreBatch.mockRejectedValue(new Error('rpc'));
    chain.readSpaceGovernanceBatch.mockRejectedValue(new Error('rpc'));
    const r = await ask('s1', mcpUser(), { with: { tally: true } });
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.items).toHaveLength(1);
    expect(r.data.items[0]!.tally).toBeNull();
  });
});

describe('visibility: get my vote', () => {
  const OTHER_VOTER = '0xdddd000000000000000000000000000000000009';
  const ask = (slug: string, caller: unknown, documentSlug = 'prop') =>
    getMyVote({ spaceSlug: slug, documentSlug }, { actor: caller as never });

  beforeEach(() => {
    voteRefs.bySpaceAndSlug = new Map([
      ['1/prop', { web3ProposalId: 10, state: 'proposal' }],
      ['1/quest', { web3ProposalId: 12, state: 'proposal' }],
      ['4/prop', { web3ProposalId: 11, state: 'proposal' }],
      ['5/prop', { web3ProposalId: 14, state: 'proposal' }],
      ['2/draft', { web3ProposalId: null, state: 'proposal' }],
    ]);
    findProposalVoteRefBySlug.mockImplementation(
      async ({ spaceId, slug }: { spaceId: number; slug: string }) =>
        voteRefs.bySpaceAndSlug.get(`${spaceId}/${slug}`) ?? null,
    );
    chain.readProposalCoreBatch.mockImplementation(
      async (ids: number[]) =>
        new Map(
          ids.map((id) => [
            id,
            {
              startTime: 0n,
              endTime: 100n,
              executed: false,
              expired: false,
              yesVotes: 1n,
              noVotes: 0n,
              totalVotingPowerAtSnapshot: 3n,
            },
          ]),
        ),
    );
    chain.readIsProposalWithdrawn.mockResolvedValue(false);
    chain.readProposalVoters.mockResolvedValue({
      yesVoters: [ADDR, OTHER_VOTER],
      noVoters: [],
    });
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: true,
      isDelegate: false,
    });
    memberPower.mockResolvedValue({
      votingPower: 5n,
      votingPowerSource: 2,
      tokenDecimals: 18,
    });
  });

  it('non-member of a space they cannot see: not found, and no vote is read', async () => {
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(findProposalVoteRefBySlug).not.toHaveBeenCalled();
    expect(chain.readProposalVoters).not.toHaveBeenCalled();
    expect(memberPower).not.toHaveBeenCalled();
  });

  it('member: the vote, the right to vote and the voting power', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: true,
      data: {
        hasVoted: true,
        vote: 'yes',
        canVote: true,
        reason: 'eligible',
        isMember: true,
        votingPower: '5',
        votingPowerSource: 2,
      },
    });
  });

  it('a non-member of a public space can see it: no vote, cannot vote, not a refusal', async () => {
    chain.readProposalVoters.mockResolvedValue({ yesVoters: [], noVoters: [] });
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: false,
      isDelegate: false,
    });
    memberPower.mockResolvedValue({
      votingPower: 0n,
      votingPowerSource: 2,
      tokenDecimals: 18,
    });
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: true,
      data: {
        hasVoted: false,
        vote: null,
        canVote: false,
        reason: 'not_member_or_delegate',
      },
    });
  });

  it('delegate and organisation sibling reach the space-level space the same way members do', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([]);
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
    clearChainFactsCaches();
    chain.readDelegateSpaceIds.mockResolvedValue([]);
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    // the organisation-level space of the tree is open to the sibling; the space-level one is not
    voteRefs.bySpaceAndSlug.set('3/prop', {
      web3ProposalId: 13,
      state: 'proposal',
    });
    expect(await ask('s3', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s5', mcpUser())).toMatchObject({ ok: false });
  });

  it('a space without an on-chain id is closed', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(findProposalVoteRefBySlug).not.toHaveBeenCalled();
  });

  it('grants: a space outside them is not found, and nothing is read', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(chain.readProposalVoters).not.toHaveBeenCalled();
  });

  it('a proposal of another space is not found (the slug is looked up inside the asked space)', async () => {
    // "prop" of space 4 exists, but the caller asks space 1 for a slug only space 4 has
    voteRefs.bySpaceAndSlug.delete('1/prop');
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(findProposalVoteRefBySlug).toHaveBeenCalledWith(
      { spaceId: 1, slug: 'prop' },
      expect.anything(),
    );
  });

  it('a document without an on-chain proposal is not found', async () => {
    expect(await ask('s2', mcpUser(), 'draft')).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('works for a Quest agreement like any other proposal', async () => {
    expect(await ask('s1', mcpUser(), 'quest')).toMatchObject({
      ok: true,
      data: { canVote: true },
    });
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
  });

  it('a chain read that fails is a typed failure, never a guess', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readProposalVoters.mockRejectedValue(new Error('rpc'));
    expect(await ask('s1', mcpUser())).toMatchObject({
      ok: false,
      code: 'chain_read_failed',
    });
  });

  it('no voter list and no address is ever returned', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    const text = JSON.stringify(r.data);
    expect(text).not.toContain('0x');
    expect(text).not.toContain(OTHER_VOTER);
    expect(r.data).not.toHaveProperty('yesVoters');
    expect(r.data).not.toHaveProperty('voters');
  });

  it('a guest is refused, and a user without a verified address too', async () => {
    expect(await ask('s1', { kind: 'guest' })).toMatchObject({
      ok: false,
      code: 'unauthenticated',
    });
    expect(
      await ask('s1', {
        kind: 'user',
        person: { id: 1 },
        address: null,
        via: via(),
      }),
    ).toMatchObject({ ok: false, code: 'invalid_identity' });
  });
});

describe('visibility: list signals', () => {
  const OTHER_PERSON = 'Hidden Person';
  const row = (over: Record<string, unknown> = {}) => ({
    id: 1,
    slug: 'sig-1',
    title: 'A signal',
    description: 'About water',
    type: 'Need',
    priority: 'high',
    tags: ['water'],
    messages: 2,
    archived: false,
    creatorId: 7,
    creatorName: 'Ada L',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    dueAt: null,
    status: 'backlog',
    board: 'general',
    assigneeIds: [8],
    indicativePayouts: [{ amount: '5', token: ADDR }],
    capitals: ['social'],
    overdue: false,
    // a field a careless presentation could leak
    address: ADDR,
    ...over,
  });
  const summaryRows = (total: number) => ({
    total,
    byType: new Map([['Need', total]]),
    byPriority: new Map([['high', total]]),
    byStatus: new Map([['backlog', total]]),
    byBoard: new Map([['general', total]]),
    overdue: 0,
    unassigned: 0,
  });
  const bySpace = new Map<number, unknown[]>();
  const ask = (
    slug: string,
    caller: unknown,
    extra: Record<string, unknown> = {},
  ) =>
    listSignals(
      { spaceSlug: slug, paging: { offset: 0, limit: 20 }, ...extra },
      { actor: caller as never },
    );

  beforeEach(() => {
    bySpace.clear();
    bySpace.set(1, [row()]);
    bySpace.set(4, [row({ slug: 'secret', title: 'secret' })]);
    bySpace.set(6, [row({ slug: 'orphan' })]);
    sig.page.mockImplementation(
      async (_c: unknown, a: { filter: { spaceId: number } }) =>
        bySpace.get(a.filter.spaceId) ?? [],
    );
    sig.summary.mockImplementation(
      async (_c: unknown, f: { spaceId: number }) =>
        summaryRows((bySpace.get(f.spaceId) ?? []).length),
    );
    sig.count.mockImplementation(
      async (_c: unknown, f: { spaceId: number }) =>
        (bySpace.get(f.spaceId) ?? []).length,
    );
    sig.tags.mockResolvedValue([{ tag: 'water', count: 1 }]);
    sig.upvotes.mockResolvedValue(new Map());
    sig.names.mockResolvedValue(new Map([[8, OTHER_PERSON]]));
    sig.symbols.mockResolvedValue(new Map());
  });

  const nothingRead = () => {
    expect(sig.page).not.toHaveBeenCalled();
    expect(sig.summary).not.toHaveBeenCalled();
    expect(sig.count).not.toHaveBeenCalled();
    expect(sig.upvotes).not.toHaveBeenCalled();
  };

  it('non-member: a public space is listed, a space-level space is not found and nothing is read', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: true });
    sig.page.mockClear();
    sig.summary.mockClear();
    sig.count.mockClear();
    sig.upvotes.mockClear();
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('member and delegate: also the space they belong to', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: [ADDR], executor: '0xe4' }]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
    clearChainFactsCaches();
    chain.readMemberSpaceIds.mockResolvedValue([]);
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
  });

  it('organisation sibling: the organisation-level space, never the space-level one', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    expect(await ask('s3', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: false });
  });

  it('a space without an on-chain id is closed and its rows are never read', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('grants: a space outside them is not found and nothing is read', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('every query carries the one checked space: a signal of another space never appears', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(sig.page.mock.calls).toHaveLength(1);
    expect(sig.page.mock.calls[0]![1].filter.spaceId).toBe(1);
    expect(sig.summary.mock.calls[0]![1].spaceId).toBe(1);
    expect(sig.tags.mock.calls[0]![1].spaceId).toBe(1);
    expect(r.data.items.map((i) => i.slug)).toEqual(['sig-1']);
    expect(JSON.stringify(r.data)).not.toContain('secret');
  });

  it('the summary is computed after the policy, over the asked space only', async () => {
    bySpace.set(1, [row(), row({ id: 2, slug: 'sig-2' })]);
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.summary?.total).toBe(2);
    expect(r.data.total).toBe(2);
    sig.summary.mockClear();
    await ask('s4', mcpUser());
    expect(sig.summary).not.toHaveBeenCalled();
  });

  it('omitting the summary skips the summary queries and still counts the filtered set', async () => {
    const r = await ask('s1', mcpUser(), { withSummary: false });
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.summary).toBeNull();
    expect(sig.summary).not.toHaveBeenCalled();
    expect(sig.tags).not.toHaveBeenCalled();
    expect(r.data.total).toBe(1);
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
    nothingRead();
  });

  it('a failing read fails the call, never an empty list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sig.page.mockRejectedValueOnce(new Error('db'));
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: false });
    sig.summary.mockRejectedValueOnce(new Error('db'));
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: false });
    sig.upvotes.mockRejectedValueOnce(new Error('db'));
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: false });
  });

  it('returns no wallet address, no person id and no voter data', async () => {
    sig.symbols.mockResolvedValue(new Map([[ADDR.toLowerCase(), 'SYM']]));
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    const text = JSON.stringify(r.data);
    expect(text).not.toContain('0x');
    expect(text).not.toMatch(/creatorId|personId|assigneeIds|address/);
    expect(r.data.items[0]!.indicativePayouts).toEqual([
      { amount: '5', tokenSymbol: 'SYM' },
    ]);
  });

  it('passes the caller person only for the filters about the caller', async () => {
    await ask('s1', mcpUser(), {
      createdByMe: true,
      legacy: { assignedToMe: true },
    });
    const f = sig.page.mock.calls[0]![1].filter;
    expect(f.createdByPersonId).toBe(1);
    expect(f.legacy.assignedToPersonId).toBe(1);
    sig.page.mockClear();
    await ask('s1', mcpUser());
    expect(sig.page.mock.calls[0]![1].filter.createdByPersonId).toBeUndefined();
  });

  it('a guest can read a public space but cannot ask about themselves', async () => {
    expect(await ask('s1', { kind: 'guest' })).toMatchObject({ ok: true });
    expect(
      await ask('s1', { kind: 'guest' }, { createdByMe: true }),
    ).toMatchObject({ ok: false, code: 'unauthenticated' });
  });

  it('exposes the task-like group only as the legacy group', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(r.data.items[0]!.taskFields).toMatchObject({
      status: 'backlog',
      statusCategory: 'backlog',
      board: 'general',
      assignees: [OTHER_PERSON],
      overdue: false,
    });
    expect(r.data.summary?.legacy.byStatus[0]).toMatchObject({
      status: 'backlog',
      name: 'Backlog',
      count: 1,
    });
  });
});

describe('visibility: list quests', () => {
  const OTHER_PERSON_ID = 99;
  const quest = (over: Record<string, unknown> = {}) => ({
    id: 1,
    slug: 'garden',
    name: 'Build the garden',
    status: 'active',
    goal: 'Plant things',
    scopeInMarkdown: '- beds',
    scopeOutMarkdown: '- roof',
    successCriteria: 'It grows',
    rewards: [
      { amount: '10', token: 'USDC' },
      { amount: '5', token: ADDR },
    ],
    targetDate: '2026-12-31',
    leadPersonId: 1,
    leadName: 'Ada L',
    proposalDocumentId: 50,
    acceptedAt: '2026-11-02T00:00:00.000Z',
    health: {
      state: 'on_track',
      marker: 80,
      summary: 'Going well',
      updatesThisWeek: 1,
      lastUpdateAt: '2026-11-20T00:00:00.000Z',
      daysToTarget: 30,
    },
    milestones: [
      {
        id: 1,
        questId: 1,
        order: 1,
        name: 'Dig',
        description: 'Dig the beds',
        dueDate: '2026-12-01',
        ownerPersonId: 1,
        ownerName: 'Ada L',
        status: 'in_progress',
      },
    ],
    members: [
      {
        id: 1,
        questId: 1,
        personId: 1,
        memberName: 'Ada L',
        memberAvatarUrl: 'https://x/a.png',
        roleLabel: 'Lead',
        responsibilities: ['Plan'],
        order: 1,
        isLead: true,
      },
      {
        id: 2,
        questId: 1,
        personId: OTHER_PERSON_ID,
        memberName: 'Grace H',
        memberAvatarUrl: null,
        roleLabel: null,
        responsibilities: [],
        order: 2,
        isLead: false,
      },
    ],
    deliverables: [
      { id: 1, questId: 1, name: 'Plan', url: 'https://x/plan', note: 'v1' },
    ],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    // fields a careless presentation could leak
    chatRoomId: '!room:example',
    updates: [{ text: 'private chatter' }],
    ...over,
  });
  const counts = (over: Record<string, number> = {}) => ({
    active: 1,
    proposed: 0,
    paused: 0,
    completed: 0,
    archived: 0,
    ...over,
  });
  const listingOf = (
    items: unknown[],
    extra: Record<string, unknown> = {},
  ) => ({
    counts: counts(),
    total: items.length,
    items,
    ...extra,
  });
  const ask = (
    slug: string,
    caller: unknown,
    extra: Record<string, unknown> = {},
  ) =>
    listQuests(
      { spaceSlug: slug, paging: { offset: 0, limit: 20 }, ...extra },
      { actor: caller as never },
    );
  const slugsOf = async (
    slug: string,
    caller: unknown,
    extra: Record<string, unknown> = {},
  ) => {
    const r = await ask(slug, caller, extra);
    if (!r.ok) throw new Error(`unexpected failure ${r.code}`);
    return r.data.items.map((item) => item.slug);
  };

  beforeEach(() => {
    quests.list.mockImplementation(
      async (_c: unknown, f: { spaceId: number }) =>
        listingOf(
          f.spaceId === 1
            ? [quest()]
            : [quest({ slug: 'secret', name: 'secret' })],
        ),
    );
    quests.docs.mockResolvedValue(
      new Map([
        [
          50,
          { id: 50, spaceId: 1, slug: 'garden-proposal', web3ProposalId: 10 },
        ],
      ]),
    );
  });

  const nothingRead = () => {
    expect(quests.list).not.toHaveBeenCalled();
    expect(quests.docs).not.toHaveBeenCalled();
  };

  it('non-member: a public space is listed, a space-level space is not found and nothing is read', async () => {
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: true });
    quests.list.mockClear();
    quests.docs.mockClear();
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('member and delegate: also the space they belong to', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: [ADDR], executor: '0xe4' }]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
    clearChainFactsCaches();
    chain.readMemberSpaceIds.mockResolvedValue([]);
    chain.readDelegateSpaceIds.mockResolvedValue([4]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[4, { members: ['0xdelegator'], executor: '0xe' }]]),
    );
    chain.readDelegatorsBatch.mockResolvedValue(
      new Map([[4, ['0xdelegator']]]),
    );
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: true });
  });

  it('organisation sibling: the organisation-level space, never the space-level one', async () => {
    chain.readMemberSpaceIds.mockResolvedValue([6]);
    chain.readSpaceMembersBatch.mockResolvedValue(
      new Map([[6, { members: [ADDR], executor: '0xe6' }]]),
    );
    expect(await ask('s3', mcpUser())).toMatchObject({ ok: true });
    expect(await ask('s4', mcpUser())).toMatchObject({ ok: false });
  });

  it('a space without an on-chain id is closed and its quests are never read', async () => {
    expect(await ask('s6', mcpUser())).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('grants: a space outside them is not found and nothing is read', async () => {
    expect(await ask('s1', mcpUser([2]))).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('every read carries the one checked space: a quest of another space never appears', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    expect(quests.list).toHaveBeenCalledTimes(1);
    expect(quests.list.mock.calls[0]![1].spaceId).toBe(1);
    expect(r.data.items.map((i) => i.slug)).toEqual(['garden']);
    expect(JSON.stringify(r.data)).not.toContain('secret');
  });

  it('fails closed when the access level cannot be read', async () => {
    chain.readSpaceVisibilityBatch.mockRejectedValue(new Error('rpc'));
    expect(await ask('s4', mcpUser())).toMatchObject({
      ok: false,
      code: 'access_check_failed',
    });
    nothingRead();
  });

  it('a failing read fails the call, never an empty list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    quests.list.mockRejectedValueOnce(new Error('db'));
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: false });
    quests.docs.mockRejectedValueOnce(new Error('db'));
    expect(await ask('s1', mcpUser())).toMatchObject({ ok: false });
  });

  it('a read writes nothing: no activation, and the sources reach no write path or draft', async () => {
    await ask('s1', mcpUser(), { includeProposalStatus: true });
    expect(quests.activate).not.toHaveBeenCalled();
    const { readFileSync } = await import('node:fs');
    for (const path of [
      '../list-quests/index.ts',
      '../../space-quests/server/list-quests-read.ts',
      '../../space-quests/server/list-quests-queries.ts',
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      const code = source
        .split(String.fromCharCode(10))
        .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line))
        .join(String.fromCharCode(10));
      expect(code, path).not.toMatch(
        /mutations|sync-proposal-status|spaceQuestDrafts|drafts|activateSpaceQuest|syncSpaceQuest|listSpaceQuests|\.insert\(|\.update\(|\.delete\(|transaction/,
      );
    }
  });

  it('mine: passes the caller person id, only when asked; a guest is refused', async () => {
    await ask('s1', mcpUser(), { mine: true });
    expect(quests.list.mock.calls[0]![1].mineOfPersonId).toBe(1);
    quests.list.mockClear();
    await ask('s1', mcpUser());
    expect(quests.list.mock.calls[0]![1].mineOfPersonId).toBeUndefined();
    expect(await ask('s1', { kind: 'guest' }, { mine: true })).toMatchObject({
      ok: false,
      code: 'unauthenticated',
    });
  });

  it('mine never widens: a grant to another space leaves nothing', async () => {
    expect(await ask('s1', mcpUser([2]), { mine: true })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    nothingRead();
  });

  it('passes the filters and the page on; counts and total come from the database', async () => {
    quests.list.mockResolvedValue(
      listingOf([quest({ slug: 'a2' })], {
        total: 7,
        counts: counts({ active: 3, proposed: 2, archived: 2 }),
      }),
    );
    const r = await ask('s1', mcpUser(), {
      status: 'active',
      includeArchived: true,
      paging: { offset: 4, limit: 2 },
    });
    if (!r.ok) throw new Error('unexpected');
    expect(quests.list.mock.calls[0]![1]).toMatchObject({
      spaceId: 1,
      status: 'active',
      includeArchived: true,
      offset: 4,
      limit: 2,
    });
    expect(r.data.total).toBe(7);
    expect(r.data.counts).toEqual({
      active: 3,
      proposed: 2,
      paused: 0,
      completed: 0,
      archived: 2,
      total: 7,
    });
  });

  it('the linked proposal counts only when its document belongs to this space', async () => {
    quests.list.mockResolvedValue(
      listingOf([
        quest({ id: 1, slug: 'ok', proposalDocumentId: 50 }),
        quest({ id: 2, slug: 'foreign', proposalDocumentId: 51 }),
        quest({ id: 3, slug: 'gone', proposalDocumentId: 52 }),
        quest({ id: 4, slug: 'none', proposalDocumentId: null }),
      ]),
    );
    quests.docs.mockResolvedValue(
      new Map([
        [50, { id: 50, spaceId: 1, slug: 'mine-doc', web3ProposalId: 10 }],
        [
          51,
          { id: 51, spaceId: 77, slug: 'other-space-doc', web3ProposalId: 11 },
        ],
      ]),
    );
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    const bySlug = Object.fromEntries(r.data.items.map((i) => [i.slug, i]));
    expect(bySlug.ok!.proposal).toEqual({ slug: 'mine-doc', status: null });
    expect(bySlug.foreign!.proposal).toBeNull();
    expect(bySlug.gone!.proposal).toBeNull();
    expect(bySlug.none!.proposal).toBeNull();
    expect(JSON.stringify(r.data)).not.toContain('other-space-doc');
  });

  it('the vote state is read only on request, only for proposed quests, and fails the call when unreadable', async () => {
    quests.list.mockResolvedValue(
      listingOf([
        quest({
          id: 1,
          slug: 'voting',
          status: 'proposed',
          proposalDocumentId: 50,
        }),
        quest({
          id: 2,
          slug: 'running',
          status: 'active',
          proposalDocumentId: 50,
        }),
      ]),
    );
    chain.readProposalOutcomeIds.mockResolvedValue({
      accepted: new Set(),
      rejected: new Set([10]),
      withdrawn: new Set(),
    });
    const off = await ask('s1', mcpUser());
    expect(chain.readProposalOutcomeIds).not.toHaveBeenCalled();
    if (!off.ok) throw new Error('unexpected');
    expect(off.data.items.every((i) => i.proposal?.status === null)).toBe(true);

    const on = await ask('s1', mcpUser(), { includeProposalStatus: true });
    if (!on.ok) throw new Error('unexpected');
    expect(chain.readProposalOutcomeIds).toHaveBeenCalledTimes(1);
    const bySlug = Object.fromEntries(on.data.items.map((i) => [i.slug, i]));
    expect(bySlug.voting!.proposal?.status).toBe('rejected');
    // the stored status is never rewritten by what the vote says
    expect(bySlug.voting!.status).toBe('proposed');
    expect(bySlug.running!.proposal?.status).toBeNull();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.readProposalOutcomeIds.mockRejectedValue(new Error('rpc'));
    expect(
      await ask('s1', mcpUser(), { includeProposalStatus: true }),
    ).toMatchObject({ ok: false, code: 'chain_read_failed' });
  });

  it('a proposal that will not appear in the answer never causes a chain read', async () => {
    quests.list.mockResolvedValue(
      listingOf([
        quest({ slug: 'foreign', status: 'proposed', proposalDocumentId: 51 }),
      ]),
    );
    quests.docs.mockResolvedValue(
      new Map([[51, { id: 51, spaceId: 77, slug: 'x', web3ProposalId: 11 }]]),
    );
    chain.readProposalOutcomeIds.mockRejectedValue(new Error('rpc'));
    expect(
      await ask('s1', mcpUser(), { includeProposalStatus: true }),
    ).toMatchObject({ ok: true });
    expect(chain.readProposalOutcomeIds).not.toHaveBeenCalled();
  });

  it('no chain read at all when no quest on the page is proposed', async () => {
    await ask('s1', mcpUser(), { includeProposalStatus: true });
    expect(chain.readProposalOutcomeIds).not.toHaveBeenCalled();
  });

  it('returns display names only: no person id, address, avatar, chat room or updates', async () => {
    const r = await ask('s1', mcpUser());
    if (!r.ok) throw new Error('unexpected');
    const text = JSON.stringify(r.data);
    expect(text).not.toContain('0x');
    expect(text).not.toMatch(/personId|avatar|chatRoom|private chatter|!room/i);
    expect(text).not.toContain(String(OTHER_PERSON_ID));
    expect(r.data.items[0]!.lead).toBe('Ada L');
    expect(r.data.items[0]!.members.map((m) => m.name)).toEqual([
      'Ada L',
      'Grace H',
    ]);
    expect(r.data.items[0]!.rewards).toEqual([
      { amount: '10', token: 'USDC' },
      { amount: '5', token: null },
    ]);
    expect(r.data.items[0]!.viewer).toEqual({ isLead: true, isMember: true });
  });
});
