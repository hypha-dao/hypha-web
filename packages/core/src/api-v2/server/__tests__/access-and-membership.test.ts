import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@hypha-platform/storage-postgres', () => ({
  documents: {
    spaceId: 'spaceId',
    web3ProposalId: 'web3ProposalId',
    slug: 'slug',
  },
}));

const findSpaceHostFieldsBySlug = vi.fn();
vi.mock('../../../space/server/queries', () => ({
  findSpaceHostFieldsBySlug: (...a: unknown[]) =>
    findSpaceHostFieldsBySlug(...a),
  findSpaceBySlug: vi.fn(),
}));
vi.mock('../../../space/server/web3/get-all-spaces', () => ({
  getAllSpaces: vi.fn(),
}));
vi.mock('../../../space/server/web3/get-spaces-by-slugs', () => ({
  getSpacesBySlugs: vi.fn(),
}));
vi.mock('../../../space/server/web3/get-spaces-by-web3-ids', () => ({
  getSpacesByWeb3Ids: vi.fn(),
}));
vi.mock('../../../space/utils', () => ({ isSpaceArchived: () => false }));
vi.mock('../../../people/server/queries', () => ({
  findPersonBySub: vi.fn(),
}));

const isOnChainMemberOrDelegate = vi.fn();
vi.mock('../../../space/server/is-on-chain-member-or-delegate', () => ({
  isOnChainMemberOrDelegate: (...a: unknown[]) =>
    isOnChainMemberOrDelegate(...a),
}));

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

const viewer = vi.hoisted(() => ({
  getSpaceLevels: vi.fn(),
  relationsForSpaces: vi.fn(),
  filterSpacesForViewer: vi.fn(),
}));
vi.mock('../viewer-access', () => viewer);

import { authorizeSpaceRead } from '../access';
import { buildMyMembershipV2 } from '../membership';

const ADDRESS = '0xAbC0000000000000000000000000000000000001' as const;
const user = {
  kind: 'user',
  person: { id: 9 },
  address: ADDRESS,
} as never;
const guest = { kind: 'guest' } as const;

const level = (n: number | undefined) =>
  viewer.getSpaceLevels.mockResolvedValue(
    n === undefined
      ? new Map()
      : new Map([[7, { discoverability: 0, access: n }]]),
  );
const relation = (r: Partial<Record<string, boolean>>) =>
  viewer.relationsForSpaces.mockResolvedValue(
    new Map([
      [
        7,
        {
          signedIn: true,
          direct: false,
          orgSibling: false,
          memberSpaceParticipant: false,
          ...r,
        },
      ],
    ]),
  );

describe('authorizeSpaceRead (the single v2 gate)', () => {
  const space = { id: 1, web3SpaceId: 7 };
  const db = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    relation({});
    isOnChainMemberOrDelegate.mockResolvedValue(false);
  });

  it('lets a guest read a PUBLIC-access space', async () => {
    level(0);
    expect(await authorizeSpaceRead(space, guest, { db })).toEqual({
      ok: true,
    });
  });

  it('is 401 for a guest on a non-public space', async () => {
    level(1);
    expect(await authorizeSpaceRead(space, guest, { db })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('lets any verified user into a NETWORK space', async () => {
    level(1);
    expect(await authorizeSpaceRead(space, user, { db })).toEqual({ ok: true });
    expect(isOnChainMemberOrDelegate).not.toHaveBeenCalled();
  });

  it('SPACE access: direct member/delegate only', async () => {
    level(3);
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 403,
    });
    isOnChainMemberOrDelegate.mockResolvedValue(true);
    expect(await authorizeSpaceRead(space, user, { db })).toEqual({ ok: true });
  });

  it('SPACE access: org sibling and member-space participant are NOT enough', async () => {
    level(3);
    relation({ orgSibling: true, memberSpaceParticipant: true });
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('ORGANISATION access admits an org sibling', async () => {
    level(2);
    relation({ orgSibling: true });
    expect(await authorizeSpaceRead(space, user, { db })).toEqual({ ok: true });
  });

  it('ORGANISATION access admits a member of a member-space (org-level)', async () => {
    level(2);
    relation({ memberSpaceParticipant: true });
    expect(await authorizeSpaceRead(space, user, { db })).toEqual({ ok: true });
  });

  it('ORGANISATION access denies an unrelated verified user', async () => {
    level(2);
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('fails closed (500) when the level cannot be read', async () => {
    level(undefined);
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 500,
    });
    viewer.getSpaceLevels.mockRejectedValue(new Error('rpc'));
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 500,
    });
  });

  it('fails closed (500) when the membership read throws', async () => {
    level(3);
    isOnChainMemberOrDelegate.mockRejectedValue(new Error('rpc'));
    expect(await authorizeSpaceRead(space, user, { db })).toMatchObject({
      ok: false,
      status: 500,
    });
  });

  it('treats a space without a web3 id as open, as v1 does', async () => {
    expect(
      await authorizeSpaceRead({ id: 2, web3SpaceId: null }, guest, { db }),
    ).toEqual({ ok: true });
    expect(viewer.getSpaceLevels).not.toHaveBeenCalled();
  });
});

describe('buildMyMembershipV2', () => {
  const db = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceHostFieldsBySlug.mockResolvedValue({ id: 1, web3SpaceId: 7 });
    chain.readChainClock.mockResolvedValue({
      nowSeconds: 150,
      asOf: '2026-10-16T00:00:00.000Z',
      asOfBlock: 5,
    });
  });

  it('reports a member', async () => {
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: true,
      isDelegate: false,
    });
    const r = await buildMyMembershipV2(
      { spaceSlug: 'alpha', caller: user },
      { db },
    );
    expect(r).toEqual({
      ok: true,
      body: {
        isMember: true,
        isDelegate: false,
        asOf: '2026-10-16T00:00:00.000Z',
        asOfBlock: 5,
      },
    });
    expect(chain.readMemberAndDelegate).toHaveBeenCalledWith(7, ADDRESS);
  });

  it('reports a delegate who is not a member', async () => {
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: false,
      isDelegate: true,
    });
    const r = await buildMyMembershipV2(
      { spaceSlug: 'alpha', caller: user },
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject({ isMember: false, isDelegate: true });
  });

  it('answers 200 with false/false for a verified non-member, never 403/404', async () => {
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: false,
      isDelegate: false,
    });
    const r = await buildMyMembershipV2(
      { spaceSlug: 'alpha', caller: user },
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject({ isMember: false, isDelegate: false });
    // no content gate, no addresses in the body
    expect(viewer.getSpaceLevels).not.toHaveBeenCalled();
    expect(JSON.stringify(r.body)).not.toContain('0x');
  });

  it('is 401 without a verified user', async () => {
    const r = await buildMyMembershipV2(
      { spaceSlug: 'alpha', caller: guest },
      { db },
    );
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(chain.readMemberAndDelegate).not.toHaveBeenCalled();
  });

  it('is 404 for an unknown space', async () => {
    findSpaceHostFieldsBySlug.mockResolvedValue(null);
    const r = await buildMyMembershipV2(
      { spaceSlug: 'nope', caller: user },
      { db },
    );
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it('returns nulls (unknown, not false) for a space with no web3 id', async () => {
    findSpaceHostFieldsBySlug.mockResolvedValue({ id: 2, web3SpaceId: null });
    const r = await buildMyMembershipV2(
      { spaceSlug: 'offchain', caller: user },
      { db },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject({ isMember: null, isDelegate: null });
    expect(chain.readMemberAndDelegate).not.toHaveBeenCalled();
  });

  it('is 502 when the chain read fails', async () => {
    chain.readMemberAndDelegate.mockRejectedValue(new Error('rpc'));
    const r = await buildMyMembershipV2(
      { spaceSlug: 'alpha', caller: user },
      { db },
    );
    expect(r).toMatchObject({ ok: false, status: 502 });
  });
});
