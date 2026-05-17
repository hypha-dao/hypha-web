import { describe, expect, it, vi } from 'vitest';
import type {
  RosterPerson,
  SpaceMemberRosterEntry,
} from '../get-space-members-roster-helpers';
import type { Space } from '../../types';

async function loadGetSpaceMembersRoster() {
  // Module import path touches storage-postgres env invariants.
  if (!process.env.DEFAULT_DB_URL) {
    process.env.DEFAULT_DB_URL = 'postgres://local:test@localhost:5432/test';
  }
  const mod = await import('../get-space-members-roster');
  return mod.getSpaceMembersRoster;
}

function makePerson(id: number, name: string): RosterPerson {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    links: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeSpace(id: number, title: string): Space {
  return {
    id,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    links: [],
    categories: [],
    flags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Space;
}

describe('getSpaceMembersRoster', () => {
  it('returns not-found shape with empty pagination metadata', async () => {
    const computeEntries = vi.fn().mockResolvedValue({ found: false as const });
    const getSpaceMembersRoster = await loadGetSpaceMembersRoster();
    const result = await getSpaceMembersRoster(
      { spaceSlug: 'missing-space', page: 2, pageSize: 5 },
      { db: {} as never },
      { computeEntries },
    );

    expect(result.found).toBe(false);
    expect(result.space_slug).toBe('missing-space');
    expect(result.space).toBeNull();
    expect(result.pagination).toEqual({
      total: 0,
      page: 2,
      page_size: 5,
      total_pages: 0,
      has_next_page: false,
      has_previous_page: false,
    });
  });

  it('paginates mixed roster entries in stable order', async () => {
    const entries: SpaceMemberRosterEntry[] = [
      {
        member_kind: 'person',
        membership: {
          id: 1,
          person_id: 10,
          space_id: 1,
          created_at: '2026-01-02T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
        join_source: 'membership',
        joined_at: '2026-01-02T00:00:00.000Z',
        person: makePerson(10, 'Alice'),
      },
      {
        member_kind: 'space',
        membership: null,
        join_source: 'unknown',
        joined_at: null,
        space: makeSpace(20, 'Partner Space'),
      },
      {
        member_kind: 'person',
        membership: null,
        join_source: 'event',
        joined_at: '2026-01-03T00:00:00.000Z',
        person: makePerson(11, 'Bob'),
      },
    ];

    const computeEntries = vi.fn().mockResolvedValue({
      found: true as const,
      host: {
        id: 1,
        slug: 'hypha',
        title: 'Hypha',
        parentId: null,
      } as Space,
      memberAddresses: [] as const,
      entries,
      source_chain: 'rpc' as const,
      asOf: '2026-01-04T00:00:00.000Z',
    });

    const getSpaceMembersRoster = await loadGetSpaceMembersRoster();
    const result = await getSpaceMembersRoster(
      { spaceSlug: 'hypha', page: 2, pageSize: 2 },
      { db: {} as never },
      { computeEntries },
    );

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.space.slug).toBe('hypha');
    expect(result.source_chain).toBe('rpc');
    expect(result.asOf).toBe('2026-01-04T00:00:00.000Z');
    expect(result.pagination).toEqual({
      total: 3,
      page: 2,
      page_size: 2,
      total_pages: 2,
      has_next_page: false,
      has_previous_page: true,
    });
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.member_kind).toBe('person');
    if (result.members[0]?.member_kind === 'person') {
      expect(result.members[0].person.name).toBe('Bob');
    }
  });

  it('applies search filter before pagination totals', async () => {
    const entries: SpaceMemberRosterEntry[] = [
      {
        member_kind: 'person',
        membership: null,
        join_source: 'unknown',
        joined_at: null,
        person: makePerson(10, 'Alice'),
      },
      {
        member_kind: 'space',
        membership: null,
        join_source: 'unknown',
        joined_at: null,
        space: makeSpace(20, 'Gamma Collective'),
      },
      {
        member_kind: 'person',
        membership: null,
        join_source: 'unknown',
        joined_at: null,
        person: makePerson(11, 'Bruno'),
      },
    ];
    const computeEntries = vi.fn().mockResolvedValue({
      found: true as const,
      host: {
        id: 1,
        slug: 'hypha',
        title: 'Hypha',
        parentId: null,
      } as Space,
      memberAddresses: [] as const,
      entries,
      source_chain: null,
      asOf: '2026-01-04T00:00:00.000Z',
    });

    const getSpaceMembersRoster = await loadGetSpaceMembersRoster();
    const result = await getSpaceMembersRoster(
      {
        spaceSlug: 'hypha',
        page: 1,
        pageSize: 20,
        searchTerm: 'gamma',
      },
      { db: {} as never },
      { computeEntries },
    );

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.pagination.total).toBe(1);
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.member_kind).toBe('space');
    if (result.members[0]?.member_kind === 'space') {
      expect(result.members[0].space.title).toContain('Gamma');
    }
  });
});
