import { describe, expect, it } from 'vitest';
import { sortSpacesByMostUsed } from '../home-space-order';

describe('sortSpacesByMostUsed', () => {
  const garden = {
    slug: 'garden',
    title: 'Garden',
    memberCount: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const sub = {
    slug: '2026-1-sub',
    title: '2026-1 SUB',
    memberCount: 40,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  const kitchen = {
    slug: 'kitchen',
    title: 'Kitchen',
    memberCount: 8,
    updatedAt: '2026-08-20T00:00:00.000Z',
  };

  it('does not sort alphabetically when usage signals exist', () => {
    const ranked = sortSpacesByMostUsed([sub, garden, kitchen], {
      lastActiveSlug: 'kitchen',
      recentSlugs: ['garden'],
    });

    expect(ranked.map((space) => space.slug)).toEqual([
      'kitchen',
      'garden',
      '2026-1-sub',
    ]);
  });

  it('boosts spaces with current attention after visit history', () => {
    const ranked = sortSpacesByMostUsed([sub, garden, kitchen], {
      recentSlugs: [],
      activitySlugs: ['garden'],
    });

    expect(ranked[0]?.slug).toBe('garden');
  });

  it('falls back to updatedAt, then member count, then name', () => {
    const ranked = sortSpacesByMostUsed([garden, sub, kitchen]);

    expect(ranked.map((space) => space.slug)).toEqual([
      'kitchen',
      '2026-1-sub',
      'garden',
    ]);
  });
});
