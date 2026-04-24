import { describe, expect, it, vi } from 'vitest';
import type { Space } from '@hypha-platform/storage-postgres';
import { loadSpaceAncestorChain } from '../space-ancestor-chain';

function row(
  p: Partial<Space> & { id: number; slug: string; title: string },
): Space {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: null,
    leadImage: null,
    logoUrl: null,
    address: '0x0',
    parentId: p.parentId ?? null,
    web3SpaceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    flags: [],
    links: [],
    chatRoomId: null,
    categories: [],
    ...p,
  } as Space;
}

describe('loadSpaceAncestorChain', () => {
  it('returns root to leaf: R > A > B', async () => {
    const root = row({ id: 1, slug: 'r', title: 'Root', parentId: null });
    const a = row({ id: 2, slug: 'a', title: 'A', parentId: 1 });
    const b = row({ id: 3, slug: 'b', title: 'B', parentId: 2 });
    const byId = new Map<number, Space | undefined>([
      [1, root],
      [2, a],
      [3, b],
    ]);
    const getById = vi.fn(async (id: number) => byId.get(id) ?? null);

    const chain = await loadSpaceAncestorChain(3, getById);

    expect(chain.map((s) => s.slug)).toEqual(['r', 'a', 'b']);
    expect(getById).toHaveBeenCalled();
  });

  it('returns a single space when it is the root', async () => {
    const root = row({ id: 1, slug: 'only', title: 'Only', parentId: null });
    const byId = new Map<number, Space | undefined>([[1, root]]);
    const getById = async (id: number) => byId.get(id) ?? null;
    const chain = await loadSpaceAncestorChain(1, getById);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.slug).toBe('only');
  });

  it('stops on cycle (ambiguous hierarchy — both nodes may appear before cycle break)', async () => {
    const a = row({ id: 1, slug: 'a', title: 'A', parentId: 2 });
    const b = row({ id: 2, slug: 'b', title: 'B', parentId: 1 });
    const byId = new Map<number, Space | undefined>([
      [1, a],
      [2, b],
    ]);
    const getById = async (id: number) => byId.get(id) ?? null;
    const chain = await loadSpaceAncestorChain(1, getById);
    expect(chain).toHaveLength(2);
    expect(new Set(chain.map((s) => s.id))).toEqual(new Set([1, 2]));
  });
});
