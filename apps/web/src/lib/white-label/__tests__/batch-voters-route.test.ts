import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findSpace, findManyDocuments, findPeopleByWeb3Addresses, multicall } =
  vi.hoisted(() => ({
    findSpace: vi.fn(),
    findManyDocuments: vi.fn(),
    findPeopleByWeb3Addresses: vi.fn(),
    multicall: vi.fn(),
  }));

vi.mock('@hypha-platform/storage-postgres', () => ({
  db: {
    query: {
      spaces: { findFirst: findSpace },
      documents: { findMany: findManyDocuments },
    },
  },
}));
vi.mock('@hypha-platform/core/server', () => ({
  findPeopleByWeb3Addresses,
}));
vi.mock('@hypha-platform/core/client', () => ({
  getProposalVoters: (args: unknown) => ({
    fn: 'getProposalVoters',
    ...(args as object),
  }),
  publicClient: { multicall },
}));

import { NextRequest } from 'next/server';
import { GET } from '../../../app/api/v1/proposal-voters/route';
import { resetMappedHostScopeCache } from '../mapped-host-scope';
import { WL_SPACE_HEADER } from '../constants';

const A = '0xAaaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa';
const B = '0xBbbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBBbbBBb';
const C = '0xCccCCCCCCCCccccCCCCCCcCCCCccCCCcCCCCCcCC';

const person = (id: number, address: string) => ({
  id,
  name: `n${id}`,
  surname: 's',
  avatarUrl: `a${id}`,
  address,
});

const get = (slugs: string | null, mapped = false) =>
  GET(
    new NextRequest(
      `https://app.example/api/v1/proposal-voters${
        slugs === null ? '' : `?slugs=${slugs}`
      }`,
      { headers: mapped ? { [WL_SPACE_HEADER]: 'own-space' } : {} },
    ),
  );

/** Chain results follow the order of the contracts it was asked for. */
const chain = (byProposal: Record<number, [string[], string[]]>) =>
  multicall.mockImplementation(
    async ({ contracts }: { contracts: { proposalId: bigint }[] }) =>
      contracts.map((c) => ({
        status: 'success',
        result: byProposal[Number(c.proposalId)],
      })),
  );

beforeEach(() => {
  resetMappedHostScopeCache();
  vi.clearAllMocks();
  findSpace.mockResolvedValue({ id: 7, web3SpaceId: 42 });
  findManyDocuments.mockResolvedValue([
    { slug: 'p1', spaceId: 7, web3ProposalId: 1 },
    { slug: 'p2', spaceId: 7, web3ProposalId: 2 },
  ]);
  chain({ 1: [[A], [B]], 2: [[B], []] });
  findPeopleByWeb3Addresses.mockResolvedValue([person(1, A), person(2, B)]);
});

describe('GET /api/v1/proposal-voters', () => {
  it('rejects a missing, empty or oversized slug list', async () => {
    expect((await get(null)).status).toBe(400);
    expect((await get(',,')).status).toBe(400);
    const many = Array.from({ length: 26 }, (_, i) => `s${i}`).join(',');
    expect((await get(many)).status).toBe(400);
    expect(findManyDocuments).not.toHaveBeenCalled();
  });

  it('accepts exactly 25 distinct slugs', async () => {
    findManyDocuments.mockResolvedValue([]);
    const max = Array.from({ length: 25 }, (_, i) => `s${i}`).join(',');
    expect((await get(max)).status).toBe(200);
  });

  it('returns voters per slug with one document query, one multicall and one people query', async () => {
    const res = await get('p1,p2');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      voters: {
        p1: [
          { id: 1, name: 'n1 s', avatarUrl: 'a1', vote: 'yes', address: A },
          { id: 2, name: 'n2 s', avatarUrl: 'a2', vote: 'no', address: B },
        ],
        p2: [{ id: 2, name: 'n2 s', avatarUrl: 'a2', vote: 'yes', address: B }],
      },
      failed: [],
    });
    expect(findManyDocuments).toHaveBeenCalledTimes(1);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(findPeopleByWeb3Addresses).toHaveBeenCalledTimes(1);
  });

  it('dedupes slugs and ignores blanks', async () => {
    await get('p1,,p1, p2 ,p1');
    const contracts = multicall.mock.calls[0]?.[0].contracts;
    expect(contracts).toHaveLength(2);
    expect(contracts.map((c: { proposalId: bigint }) => c.proposalId)).toEqual([
      1n,
      2n,
    ]);
  });

  it('omits an unknown slug and a document without a proposal', async () => {
    findManyDocuments.mockResolvedValue([
      { slug: 'p1', spaceId: 7, web3ProposalId: 1 },
      { slug: 'draft', spaceId: 7, web3ProposalId: null },
    ]);
    const body = await (await get('p1,draft,nope')).json();
    expect(Object.keys(body.voters)).toEqual(['p1']);
    expect(body.failed).toEqual([]);
  });

  it('treats prototype-like slugs as ordinary slugs', async () => {
    findManyDocuments.mockResolvedValue([
      { slug: '__proto__', spaceId: 7, web3ProposalId: 1 },
      { slug: 'constructor', spaceId: 7, web3ProposalId: 2 },
    ]);
    const body = await (await get('__proto__,constructor,toString')).json();
    expect(Object.keys(body.voters).sort()).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(body.voters.constructor).toHaveLength(1);
  });

  it('keeps a proposal with no voters as an empty list', async () => {
    chain({ 1: [[], []], 2: [[], []] });
    findPeopleByWeb3Addresses.mockResolvedValue([]);
    const body = await (await get('p1')).json();
    expect(body.voters).toEqual({ p1: [] });
  });

  it('does not show a voter on a proposal they did not vote on', async () => {
    chain({ 1: [[A], []], 2: [[], [C]] });
    findPeopleByWeb3Addresses.mockResolvedValue([person(1, A), person(3, C)]);
    const body = await (await get('p1,p2')).json();
    expect(body.voters.p1.map((v: { id: number }) => v.id)).toEqual([1]);
    expect(body.voters.p2.map((v: { id: number }) => v.id)).toEqual([3]);
    expect(body.voters.p2[0].vote).toBe('no');
  });

  it('matches voter addresses regardless of case', async () => {
    chain({ 1: [[A.toLowerCase()], []], 2: [[], []] });
    findPeopleByWeb3Addresses.mockResolvedValue([person(1, A)]);
    const body = await (await get('p1')).json();
    expect(body.voters.p1[0].vote).toBe('yes');
  });

  it('isolates a failed chain read to its slug', async () => {
    multicall.mockResolvedValue([
      { status: 'failure', error: new Error('rpc') },
      { status: 'success', result: [[B], []] },
    ]);
    findPeopleByWeb3Addresses.mockResolvedValue([person(2, B)]);
    const res = await get('p1,p2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failed).toEqual(['p1']);
    expect(Object.keys(body.voters)).toEqual(['p2']);
  });

  it('answers 500 when a query throws', async () => {
    findManyDocuments.mockRejectedValue(new Error('db'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await get('p1')).status).toBe(500);
  });

  describe('mapped host', () => {
    it('serves only documents of the host Space', async () => {
      findManyDocuments.mockResolvedValue([
        { slug: 'p1', spaceId: 7, web3ProposalId: 1 },
        { slug: 'p2', spaceId: 99, web3ProposalId: 2 },
      ]);
      const body = await (await get('p1,p2', true)).json();
      expect(Object.keys(body.voters)).toEqual(['p1']);
      // The foreign proposal is never read from the chain.
      const contracts = multicall.mock.calls[0]?.[0].contracts;
      expect(contracts).toHaveLength(1);
    });

    it('answers 404 for an unknown host Space and reads nothing', async () => {
      findSpace.mockResolvedValue(undefined);
      const res = await get('p1', true);
      expect(res.status).toBe(404);
      expect(findManyDocuments).not.toHaveBeenCalled();
      expect(multicall).not.toHaveBeenCalled();
    });

    it('resolves the host Space once per request', async () => {
      await get('p1,p2', true);
      expect(findSpace).toHaveBeenCalledTimes(1);
    });
  });
});
