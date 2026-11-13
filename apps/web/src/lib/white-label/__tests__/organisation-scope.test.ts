import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findSpace, findSpaceBySlug, getOrgSpaces, readContract } = vi.hoisted(
  () => ({
    findSpace: vi.fn(),
    findSpaceBySlug: vi.fn(),
    getOrgSpaces: vi.fn(),
    readContract: vi.fn(),
  }),
);

vi.mock('@hypha-platform/storage-postgres', () => ({
  db: { query: { spaces: { findFirst: findSpace } } },
}));
vi.mock('@hypha-platform/core/server', () => ({
  findSpaceBySlug,
  getAllOrganizationSpacesForNodeById: getOrgSpaces,
  web3Client: { readContract },
}));
vi.mock('@hypha-platform/core/client', () => ({
  getSpaceVisibility: (args: { spaceId: bigint }) => args,
}));

import { NextRequest } from 'next/server';
import { GET } from '../../../app/api/v1/spaces/[spaceSlug]/organisation/route';
import { resetMappedHostScopeCache } from '../mapped-host-scope';
import { keepPublicSpaces, resetPublicSpacesCache } from '../public-spaces';
import { WL_SPACE_HEADER } from '../constants';

const OWN = { id: 7, web3SpaceId: 42 };
/** access level per web3SpaceId, as the contract returns `{ access }`. */
const LEVELS: Record<number, number> = { 42: 3, 43: 0, 44: 2, 45: 0 };
const TREE = [
  { id: 7, web3SpaceId: 42, slug: 'own-space' },
  { id: 8, web3SpaceId: 43, slug: 'public-sibling' },
  { id: 9, web3SpaceId: 44, slug: 'private-sibling' },
  { id: 10, web3SpaceId: 45, slug: 'public-child' },
  { id: 11, web3SpaceId: null, slug: 'off-chain' },
];

const call = (mapped: boolean, slug = 'own-space') =>
  GET(
    new NextRequest(`https://app.example/api/v1/spaces/${slug}/organisation`, {
      headers: mapped ? { [WL_SPACE_HEADER]: 'own-space' } : {},
    }),
    { params: Promise.resolve({ spaceSlug: slug }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetMappedHostScopeCache();
  resetPublicSpacesCache();
  findSpace.mockResolvedValue(OWN);
  findSpaceBySlug.mockResolvedValue({ id: 7, web3SpaceId: 42 });
  getOrgSpaces.mockResolvedValue(TREE);
  readContract.mockImplementation(async ({ spaceId }: { spaceId: bigint }) => {
    const level = LEVELS[Number(spaceId)];
    if (level === undefined) throw new Error('unreadable');
    return { access: level };
  });
});

describe('GET /api/v1/spaces/:slug/organisation', () => {
  it('main app (no Space header): the whole tree, unchanged, no chain read', async () => {
    const res = await call(false);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TREE);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('mapped host: own Space and PUBLIC Spaces only, in order', async () => {
    const res = await call(true);
    expect(res.status).toBe(200);
    const slugs = (await res.json()).map((s: { slug: string }) => s.slug);
    expect(slugs).toEqual(['own-space', 'public-sibling', 'public-child']);
  });

  it('mapped host: the own Space is kept even when it is not public', async () => {
    // own Space level is 3 (SPACE) in LEVELS and it is still served
    const slugs = (await (await call(true)).json()).map(
      (s: { slug: string }) => s.slug,
    );
    expect(slugs).toContain('own-space');
    expect(slugs).not.toContain('private-sibling');
  });

  it('mapped host: another Space than its own is a 404', async () => {
    findSpaceBySlug.mockResolvedValue({ id: 99, web3SpaceId: 50 });
    expect((await call(true, 'other-space')).status).toBe(404);
    expect(getOrgSpaces).not.toHaveBeenCalled();
  });

  it('mapped host: an unknown host Space is a 404', async () => {
    findSpace.mockResolvedValue(undefined);
    expect((await call(true)).status).toBe(404);
  });
});

describe('keepPublicSpaces', () => {
  it('fails closed: unreadable level or no on-chain id is dropped', async () => {
    const out = await keepPublicSpaces(
      [
        { web3SpaceId: 1 },
        { web3SpaceId: 2 },
        { web3SpaceId: null },
        { web3SpaceId: undefined },
      ],
      null,
      async (id) => (id === 1 ? 0 : null),
    );
    expect(out).toEqual([{ web3SpaceId: 1 }]);
  });

  it('reads in batches and keeps order for a large tree', async () => {
    const spaces = Array.from({ length: 35 }, (_, i) => ({
      web3SpaceId: i + 1,
    }));
    let inFlight = 0;
    let peak = 0;
    const out = await keepPublicSpaces(spaces, null, async (id) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return id % 2 === 0 ? 0 : 3;
    });
    expect(out.map((s) => s.web3SpaceId)).toEqual(
      spaces.filter((s) => s.web3SpaceId % 2 === 0).map((s) => s.web3SpaceId),
    );
    expect(peak).toBeLessThanOrEqual(10);
  });
});
