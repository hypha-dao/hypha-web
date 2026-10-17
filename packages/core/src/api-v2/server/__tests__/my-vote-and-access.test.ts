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
vi.mock('../../../governance/server/queries', () => ({
  findAllDocumentsBySpaceSlug: vi.fn(),
}));
vi.mock('../../../people/server/queries', () => ({
  findPersonBySub: vi.fn(),
}));
vi.mock('../../../common/server/verify-privy-auth-token', () => ({
  verifyPrivyAuthToken: vi.fn(),
}));

const isOnChainMemberOrDelegate = vi.fn();
vi.mock('../../../space/server/is-on-chain-member-or-delegate', () => ({
  isOnChainMemberOrDelegate: (...a: unknown[]) =>
    isOnChainMemberOrDelegate(...a),
}));

const getMemberVotingPower = vi.fn();
vi.mock('../../../coherence/server/web3/get-member-voting-power', () => ({
  getMemberVotingPower: (...a: unknown[]) => getMemberVotingPower(...a),
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

import { authorizeSpaceRead, resolveV2Caller } from '../access';
import { verifyPrivyAuthToken } from '../../../common/server/verify-privy-auth-token';
import { findPersonBySub } from '../../../people/server/queries';
import { buildMyVoteV2 } from '../documents';
import { buildMyMembershipV2 } from '../membership';

const ADDRESS = '0xAbC0000000000000000000000000000000000001' as const;
const user = {
  kind: 'user',
  person: { id: 9 },
  address: ADDRESS,
} as never;
const guest = { kind: 'guest' } as const;

function dbReturning(rows: unknown[]) {
  const chainable = {
    from: () => chainable,
    where: () => chainable,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => chainable } as never;
}

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

describe('buildMyVoteV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    level(0);
    findSpaceHostFieldsBySlug.mockResolvedValue({ id: 1, web3SpaceId: 7 });
    chain.readChainClock.mockResolvedValue({
      nowSeconds: 150,
      asOf: '2026-10-15T00:00:00.000Z',
      asOfBlock: 1,
    });
    chain.readProposalCoreBatch.mockResolvedValue(
      new Map([
        [
          11,
          {
            startTime: 100n,
            endTime: 200n,
            executed: false,
            expired: false,
            yesVotes: 1n,
            noVotes: 0n,
            totalVotingPowerAtSnapshot: 3n,
          },
        ],
      ]),
    );
    chain.readIsProposalWithdrawn.mockResolvedValue(false);
    chain.readProposalVoters.mockResolvedValue({
      yesVoters: [ADDRESS.toLowerCase()],
      noVoters: [],
    });
    chain.readMemberAndDelegate.mockResolvedValue({
      isMember: true,
      isDelegate: false,
    });
    getMemberVotingPower.mockResolvedValue({
      votingPower: 1n,
      votingPowerSource: 2,
      tokenDecimals: 0,
    });
  });

  const input = { spaceSlug: 'alpha', documentSlug: 'p-1' };

  it('requires a verified user', async () => {
    const r = await buildMyVoteV2(
      { ...input, caller: guest },
      { db: dbReturning([]) },
    );
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('is 404 when the document is not in this space or has no proposal', async () => {
    const wrongSpace = await buildMyVoteV2(
      { ...input, caller: user },
      { db: dbReturning([{ spaceId: 99, web3ProposalId: 11 }]) },
    );
    expect(wrongSpace).toMatchObject({ ok: false, status: 404 });

    const noProposal = await buildMyVoteV2(
      { ...input, caller: user },
      { db: dbReturning([{ spaceId: 1, web3ProposalId: null }]) },
    );
    expect(noProposal).toMatchObject({ ok: false, status: 404 });
  });

  it('matches the vote case-insensitively and reports eligibility', async () => {
    const r = await buildMyVoteV2(
      { ...input, caller: user },
      { db: dbReturning([{ spaceId: 1, web3ProposalId: 11 }]) },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject({
      hasVoted: true,
      vote: 'yes',
      isMember: true,
      isDelegate: false,
      votingPower: '1',
      votingPowerSource: 2,
      canVote: true,
      reason: 'eligible',
    });
  });

  it('reports a closed window without hiding the vote', async () => {
    chain.readChainClock.mockResolvedValue({
      nowSeconds: 500,
      asOf: 'x',
      asOfBlock: 1,
    });
    const r = await buildMyVoteV2(
      { ...input, caller: user },
      { db: dbReturning([{ spaceId: 1, web3ProposalId: 11 }]) },
    );
    if (!r.ok) throw new Error('unexpected');
    expect(r.body).toMatchObject({
      hasVoted: true,
      canVote: false,
      reason: 'voting_ended',
    });
  });

  it('is 502 when a chain read fails', async () => {
    chain.readProposalVoters.mockRejectedValue(new Error('rpc'));
    const r = await buildMyVoteV2(
      { ...input, caller: user },
      { db: dbReturning([{ spaceId: 1, web3ProposalId: 11 }]) },
    );
    expect(r).toMatchObject({ ok: false, status: 502 });
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

describe('resolveV2Caller (optional user token)', () => {
  const db = {} as never;
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no Authorization header is a guest', async () => {
    expect(await resolveV2Caller(null, { db })).toEqual({
      ok: true,
      caller: { kind: 'guest' },
    });
  });

  it('an invalid token is 401, never a silent guest', async () => {
    vi.mocked(verifyPrivyAuthToken).mockResolvedValue({
      ok: false,
      reason: 'bad',
    });
    expect(await resolveV2Caller('Bearer nope', { db })).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(await resolveV2Caller('Basic abc', { db })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('a valid token without a Hypha profile is 403', async () => {
    vi.mocked(verifyPrivyAuthToken).mockResolvedValue({
      ok: true,
      userId: 'u',
    });
    vi.mocked(findPersonBySub).mockResolvedValue(null);
    expect(await resolveV2Caller('Bearer ok', { db })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('a valid token resolves the user', async () => {
    vi.mocked(verifyPrivyAuthToken).mockResolvedValue({
      ok: true,
      userId: 'u',
    });
    vi.mocked(findPersonBySub).mockResolvedValue({
      id: 1,
      address: ADDRESS,
    } as never);
    const r = await resolveV2Caller('Bearer ok', { db });
    expect(r).toMatchObject({
      ok: true,
      caller: { kind: 'user', address: ADDRESS },
    });
  });
});
