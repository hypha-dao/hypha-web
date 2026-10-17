import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract tests (K12): for every enriched route the v2 body contains the v1
 * body's fields unchanged. The v1 body is, by construction, the return value of
 * the core function the v1 handler returns as-is, so each test feeds one
 * fixture through the mocked core function and compares both shapes.
 */

vi.mock('server-only', () => ({}));
vi.mock('@hypha-platform/storage-postgres', () => ({
  documents: {
    spaceId: 'spaceId',
    web3ProposalId: 'web3ProposalId',
    slug: 'slug',
  },
}));
vi.mock('../../../space/utils', () => ({
  isSpaceArchived: (s: { flags?: string[]; memberCount?: number }) =>
    s.flags?.includes('archived') === true || s.memberCount === 0,
}));

const findSpaceBySlug = vi.fn();
const findSpaceHostFieldsBySlug = vi.fn();
vi.mock('../../../space/server/queries', () => ({
  findSpaceBySlug: (...a: unknown[]) => findSpaceBySlug(...a),
  findSpaceHostFieldsBySlug: (...a: unknown[]) =>
    findSpaceHostFieldsBySlug(...a),
}));

const getAllSpaces = vi.fn();
vi.mock('../../../space/server/web3/get-all-spaces', () => ({
  getAllSpaces: (...a: unknown[]) => getAllSpaces(...a),
}));
vi.mock('../../../space/server/web3/get-spaces-by-slugs', () => ({
  getSpacesBySlugs: vi.fn(),
}));
vi.mock('../../../space/server/web3/get-spaces-by-web3-ids', () => ({
  getSpacesByWeb3Ids: vi.fn(),
}));

const findAllDocumentsBySpaceSlug = vi.fn();
vi.mock('../../../governance/server/queries', () => ({
  findAllDocumentsBySpaceSlug: (...a: unknown[]) =>
    findAllDocumentsBySpaceSlug(...a),
}));

vi.mock('../../../coherence/server/web3/get-member-voting-power', () => ({
  getMemberVotingPower: vi.fn(),
}));

const authorizeSpaceRead = vi.fn();
vi.mock('../access', () => ({
  authorizeSpaceRead: (...a: unknown[]) => authorizeSpaceRead(...a),
}));

const viewer = vi.hoisted(() => ({
  filterSpacesForViewer: vi.fn(),
  getSpaceLevels: vi.fn(),
  relationsForSpaces: vi.fn(),
}));
vi.mock('../viewer-access', () => viewer);

const chain = vi.hoisted(() => ({
  readChainClock: vi.fn(),
  readSpaceGovernanceBatch: vi.fn(),
  readSpaceVisibilityBatch: vi.fn(),
  readProposalOutcomeIds: vi.fn(),
  readProposalCoreBatch: vi.fn(),
  readProposalVoters: vi.fn(),
  readMemberAndDelegate: vi.fn(),
  readIsProposalWithdrawn: vi.fn(),
}));
vi.mock('../chain-reads', () => chain);

import { buildSpacesListV2, buildSpaceV2 } from '../spaces';
const list = (q: Parameters<typeof buildSpacesListV2>[0]) =>
  buildSpacesListV2(q, { kind: 'guest' }, { db: {} as never });
import { buildDocumentsListV2 } from '../documents';
import {
  V2_EXPLICIT_OMISSIONS,
  V2_RESPONSE_DENYLIST,
} from '../../public-profile';

const GUEST = { kind: 'guest' } as const;
const db = {} as never;

/** v1 item minus exactly the named, documented omissions; nothing else. */
function minus<T extends Record<string, unknown>>(
  item: T,
  omitted: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !omitted.includes(key)),
  );
}

/** Fails on any denylisted key at any depth (privacy rule, public-profile.ts). */
function findDenied(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findDenied(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => {
      const here = path ? `${path}.${key}` : key;
      const denied =
        (V2_RESPONSE_DENYLIST as readonly string[]).includes(key) ||
        (key === 'address' && /(^|\.)creator$|(^|\.)person$/.test(path));
      return [...(denied ? [here] : []), ...findDenied(v, here)];
    });
  }
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeSpaceRead.mockResolvedValue({ ok: true });
  // contract tests: everything is visible; the filter itself is tested in viewer-access.test.ts
  viewer.filterSpacesForViewer.mockImplementation(
    async (spaces: unknown[]) => ({
      visible: spaces,
      levels: new Map([[7, { discoverability: 0, access: 1 }]]),
    }),
  );
  chain.readChainClock.mockResolvedValue({
    nowSeconds: 1000,
    asOf: '2026-10-15T00:00:00.000Z',
    asOfBlock: 42,
  });
  chain.readSpaceVisibilityBatch.mockResolvedValue(
    new Map([[7, { discoverability: 0, access: 1 }]]),
  );
  chain.readSpaceGovernanceBatch.mockResolvedValue(
    new Map([
      [
        7,
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

describe('GET /api/v2/spaces (twin: GET /api/v1/spaces)', () => {
  const v1Body = [
    {
      id: 1,
      slug: 'alpha',
      title: 'Alpha',
      web3SpaceId: 7,
      memberCount: 5,
      memberAddresses: ['0xaaa', '0xbbb'],
      flags: [],
    },
    {
      id: 2,
      slug: 'beta',
      title: 'Beta',
      web3SpaceId: null,
      flags: ['sandbox'],
    },
  ];

  it('contains every v1 item unchanged, with and without blocks', async () => {
    getAllSpaces.mockResolvedValue(structuredClone(v1Body));

    const plain = await list({});
    if (!plain.ok) throw new Error('unexpected');
    expect(plain.body.pagination).toBeNull();
    plain.body.data.forEach((item, i) => {
      expect(item).toMatchObject(
        minus(v1Body[i]!, V2_EXPLICIT_OMISSIONS.spacesListItem),
      );
      expect(item).not.toHaveProperty('memberAddresses');
    });
    expect(findDenied(plain.body)).toEqual([]);
    expect(plain.body.data[0]).not.toHaveProperty('visibility');

    const enriched = await list({
      include: 'visibility,governance',
    });
    if (!enriched.ok) throw new Error('unexpected');
    enriched.body.data.forEach((item, i) =>
      expect(item).toMatchObject(
        minus(v1Body[i]!, V2_EXPLICIT_OMISSIONS.spacesListItem),
      ),
    );
    expect(findDenied(enriched.body)).toEqual([]);
    expect(enriched.body.data[0]).toMatchObject({
      visibility: { discoverability: 0, access: 1 },
      governance: { quorum: 40, unity: 70, votingPowerSource: 2 },
    });
    expect(enriched.body.data[0]!.governance).not.toHaveProperty('memberCount');
    // no web3 id: unknown, not absent
    expect(enriched.body.data[1]).toMatchObject({
      visibility: null,
      governance: null,
    });
  });

  it('filters before paginating: totals describe what the viewer may see', async () => {
    getAllSpaces.mockResolvedValue(structuredClone(v1Body));
    viewer.filterSpacesForViewer.mockImplementation(
      async (all: Array<{ slug: string }>) => ({
        visible: all.filter((s) => s.slug === 'alpha'),
        levels: new Map([[7, { discoverability: 0, access: 1 }]]),
      }),
    );
    const r = await list({ page: 1, pageSize: 10 });
    if (!r.ok) throw new Error('unexpected');
    expect(r.body.data.map((s) => s.slug)).toEqual(['alpha']);
    expect(r.body.pagination).toMatchObject({ total: 1 });
    // the filter received the caller, not a pre-filtered list
    expect(viewer.filterSpacesForViewer).toHaveBeenCalledWith(
      expect.any(Array),
      { kind: 'guest' },
      expect.anything(),
    );
  });

  it('rejects unknown and single-space-only blocks with 400', async () => {
    expect(await list({ include: 'all' })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await list({ include: 'counts' })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('applies omit filters and optional pagination', async () => {
    getAllSpaces.mockResolvedValue(structuredClone(v1Body));
    const r = await list({
      omitSandbox: true,
      page: 1,
      pageSize: 1,
    });
    if (!r.ok) throw new Error('unexpected');
    expect(r.body.data.map((s) => s.slug)).toEqual(['alpha']);
    expect(r.body.pagination).toMatchObject({ total: 1, page: 1, pageSize: 1 });
  });
});

describe('GET /api/v2/spaces/{slug} (twin: GET /api/v1/spaces/[spaceSlug])', () => {
  const v1Body = {
    id: 1,
    slug: 'alpha',
    title: 'Alpha',
    web3SpaceId: 7,
    subspaces: [],
    members: [],
    documents: [],
    // never present in v1 single-space; planted to prove v2 strips it
    memberAddresses: ['0xaaa'],
  };

  beforeEach(() => {
    findSpaceHostFieldsBySlug.mockResolvedValue({ id: 1, web3SpaceId: 7 });
    findSpaceBySlug.mockResolvedValue(structuredClone(v1Body));
  });

  it('contains the v1 body unchanged and adds only requested blocks', async () => {
    const r = await buildSpaceV2(
      { slug: 'alpha', caller: GUEST, include: 'visibility,governance,counts' },
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject(
      minus(v1Body, V2_EXPLICIT_OMISSIONS.spaceDetail),
    );
    expect(findDenied(r.body)).toEqual([]);
    expect(r.body.counts).toEqual({ memberCount: 5 });
    expect(r.body.visibility).toEqual({ discoverability: 0, access: 1 });
    expect(r.body.governance).toEqual({
      quorum: 40,
      unity: 70,
      votingPowerSource: 2,
      joinMethod: 0,
      exitMethod: 0,
    });

    const bare = await buildSpaceV2({ slug: 'alpha', caller: GUEST }, { db });
    if (!bare.ok) throw new Error('unexpected');
    expect(bare.body).toMatchObject(
      minus(v1Body, V2_EXPLICIT_OMISSIONS.spaceDetail),
    );
    expect(bare.body).not.toHaveProperty('counts');
  });

  it('runs the access gate before the heavy v1 load', async () => {
    authorizeSpaceRead.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Authentication required',
    });
    const r = await buildSpaceV2({ slug: 'alpha', caller: GUEST }, { db });
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(findSpaceBySlug).not.toHaveBeenCalled();
  });

  it('is 404 for an unknown space and 400 for an unknown block', async () => {
    findSpaceHostFieldsBySlug.mockResolvedValue(null);
    expect(
      await buildSpaceV2({ slug: 'nope', caller: GUEST }, { db }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      await buildSpaceV2(
        { slug: 'a', caller: GUEST, include: 'tally' },
        { db },
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it('reports unknown counts as null, never a silent 0', async () => {
    chain.readSpaceGovernanceBatch.mockResolvedValue(new Map());
    const r = await buildSpaceV2(
      { slug: 'alpha', caller: GUEST, include: 'counts' },
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body.counts).toEqual({ memberCount: null });
  });
});

describe('GET /api/v2/spaces/{slug}/documents (twin: v1 .../documents)', () => {
  const v1Body = {
    data: [
      {
        id: 1,
        slug: 'p-1',
        title: 'One',
        web3ProposalId: 11,
        state: 'proposal',
        creator: {
          name: 'Ada',
          surname: 'L',
          avatarUrl: 'a.png',
          type: 'person',
          address: '0xcreator',
        },
      },
      {
        id: 2,
        slug: 'p-2',
        title: 'Two',
        web3ProposalId: 12,
        state: 'proposal',
      },
      {
        id: 3,
        slug: 'p-3',
        title: 'Three',
        web3ProposalId: 13,
        state: 'agreement',
      },
      {
        id: 4,
        slug: 'd-1',
        title: 'Discussion',
        web3ProposalId: null,
        state: 'discussion',
      },
    ],
    pagination: {
      total: 4,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  beforeEach(() => {
    findSpaceHostFieldsBySlug.mockResolvedValue({ id: 1, web3SpaceId: 7 });
    findAllDocumentsBySpaceSlug.mockResolvedValue(structuredClone(v1Body));
    chain.readProposalOutcomeIds.mockResolvedValue({
      accepted: new Set([11]),
      rejected: new Set([12, 13]),
      withdrawn: new Set([13]),
    });
  });

  it('contains the v1 body unchanged and adds status', async () => {
    const r = await buildDocumentsListV2({ spaceSlug: 'alpha' }, GUEST, {
      db,
    });
    if (!r.ok) throw new Error('unexpected');
    expect(r.body.pagination).toEqual(v1Body.pagination);
    r.body.data.forEach((item, i) => {
      const { status, ...rest } = item as Record<string, unknown>;
      void status;
      const v1Item = structuredClone(v1Body.data[i]) as Record<string, any>;
      if (v1Item.creator) {
        v1Item.creator = minus(
          v1Item.creator,
          V2_EXPLICIT_OMISSIONS.documentCreator,
        );
      }
      expect(rest).toEqual(v1Item);
    });
    expect(findDenied(r.body)).toEqual([]);
    expect(r.body.data[0]!.creator).not.toHaveProperty('address');
    expect(r.body.data.map((d) => d.status)).toEqual([
      'accepted',
      'rejected',
      'withdrawn',
      undefined,
    ]);
    expect(r.body.data[0]).not.toHaveProperty('tally');
    expect(chain.readProposalCoreBatch).not.toHaveBeenCalled();
  });

  it('adds the tally block only with include=tally', async () => {
    chain.readProposalCoreBatch.mockResolvedValue(
      new Map([
        [
          11,
          {
            startTime: 100n,
            endTime: 900n,
            executed: true,
            expired: false,
            yesVotes: 3n,
            noVotes: 0n,
            totalVotingPowerAtSnapshot: 5n,
          },
        ],
        [
          12,
          {
            startTime: 100n,
            endTime: 900n,
            executed: false,
            expired: false,
            yesVotes: 1n,
            noVotes: 1n,
            totalVotingPowerAtSnapshot: 5n,
          },
        ],
      ]),
    );
    const r = await buildDocumentsListV2(
      { spaceSlug: 'alpha', include: 'tally' },
      GUEST,
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    const [one, two, three, discussion] = r.body.data;
    expect(one!.tally).toMatchObject({
      executed: true,
      awaitingDecision: false,
    });
    // now (1000) > endTime (900), not executed, not expired
    expect(two!.tally).toMatchObject({ awaitingDecision: true });
    // a proposal whose read failed: null, not absent
    expect(three!.tally).toBeNull();
    // no web3ProposalId: no tally key at all
    expect(discussion).not.toHaveProperty('tally');
    expect(chain.readProposalCoreBatch).toHaveBeenCalledWith([11, 12, 13]);
  });

  it('caps pageSize at 100 and defaults it to 20', async () => {
    await buildDocumentsListV2({ spaceSlug: 'a', pageSize: 5000 }, GUEST, {
      db,
    });
    expect(
      findAllDocumentsBySpaceSlug.mock.calls[0]![1].pagination.pageSize,
    ).toBe(100);
    await buildDocumentsListV2({ spaceSlug: 'a' }, GUEST, { db });
    expect(
      findAllDocumentsBySpaceSlug.mock.calls[1]![1].pagination.pageSize,
    ).toBe(20);
  });

  it('is 502 when outcomes cannot be read (status is never silently absent)', async () => {
    chain.readProposalOutcomeIds.mockRejectedValue(new Error('rpc'));
    const r = await buildDocumentsListV2({ spaceSlug: 'a' }, GUEST, { db });
    expect(r).toMatchObject({ ok: false, status: 502 });
  });

  it('stops at the gate and rejects unknown blocks', async () => {
    expect(
      await buildDocumentsListV2(
        { spaceSlug: 'a', include: 'visibility' },
        GUEST,
        { db },
      ),
    ).toMatchObject({ ok: false, status: 400 });

    authorizeSpaceRead.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Access denied',
    });
    expect(
      await buildDocumentsListV2({ spaceSlug: 'a' }, GUEST, { db }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(findAllDocumentsBySpaceSlug).not.toHaveBeenCalled();
  });
});

describe('privacy denylist walker', () => {
  it('catches planted sensitive keys, so a regression cannot pass silently', () => {
    expect(
      findDenied({
        data: [
          { email: 'x', creator: { address: '0x1' } },
          { person: { address: '0x2', sub: 's' }, memberAddresses: [] },
        ],
      }).sort(),
    ).toEqual(
      [
        'data[0].email',
        'data[0].creator.address',
        'data[1].person.address',
        'data[1].person.sub',
        'data[1].memberAddresses',
      ].sort(),
    );
  });

  it("does not flag a space's own scalar address", () => {
    expect(findDenied({ data: [{ slug: 'a', address: '0xspace' }] })).toEqual(
      [],
    );
  });
});
