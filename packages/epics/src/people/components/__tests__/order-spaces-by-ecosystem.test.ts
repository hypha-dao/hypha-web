import { describe, expect, it } from 'vitest';
import {
  flattenEcosystemSpaceGroups,
  groupSpacesByEcosystemRecency,
} from '../member-home-spaces-rail';

type Row = {
  id: number;
  slug: string;
  parentId?: number | null;
};

describe('groupSpacesByEcosystemRecency', () => {
  it('puts the root first in each group and the most recent ecosystem first', () => {
    const spaces: Row[] = [
      { id: 2, slug: 'child-a', parentId: 1 },
      { id: 1, slug: 'root-a', parentId: null },
      { id: 4, slug: 'child-b', parentId: 3 },
      { id: 3, slug: 'root-b', parentId: null },
    ];

    const groups = groupSpacesByEcosystemRecency(spaces, ['child-b', 'root-a']);

    expect(groups.map((group) => group.rootId)).toEqual([3, 1]);
    expect(groups[0]?.spaces.map((space) => space.slug)).toEqual([
      'root-b',
      'child-b',
    ]);
    expect(groups[1]?.spaces.map((space) => space.slug)).toEqual([
      'root-a',
      'child-a',
    ]);
  });

  it('groups siblings under a missing parent and keeps a flat recent order', () => {
    const spaces: Row[] = [
      { id: 11, slug: 'leaf-1', parentId: 10 },
      { id: 12, slug: 'leaf-2', parentId: 10 },
      { id: 20, slug: 'solo', parentId: null },
    ];

    const flat = flattenEcosystemSpaceGroups(
      groupSpacesByEcosystemRecency(spaces, ['leaf-2', 'solo']),
    );

    expect(flat.map((space) => space.slug)).toEqual([
      'leaf-2',
      'leaf-1',
      'solo',
    ]);
  });
});
