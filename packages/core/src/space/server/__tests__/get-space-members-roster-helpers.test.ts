import { describe, expect, it } from 'vitest';
import { buildMemberEntriesFromAddresses } from '../get-space-members-roster-helpers';
import type { Space } from '../../types';
import type { Membership } from '@hypha-platform/storage-postgres';

describe('buildMemberEntriesFromAddresses', () => {
  it('maps on-chain order to person then space entries with full membership snake fields', () => {
    const p1 = {
      id: 10,
      slug: 'alice',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    };
    const s1 = {
      id: 20,
      title: 'Child Org',
      slug: 'child',
      description: null,
      links: [],
      categories: [],
      flags: [],
      createdAt: new Date('2020-01-02'),
      updatedAt: new Date('2020-01-02'),
      address: '0xabc',
    } as Space;

    const peopleByAddress = new Map([
      ['0x1111111111111111111111111111111111111111', p1],
    ]);
    const spacesByAddress = new Map([
      ['0x2222222222222222222222222222222222222222', s1],
    ]);
    const m: Membership = {
      id: 1,
      personId: 10,
      spaceId: 1,
      createdAt: new Date('2024-06-01'),
      updatedAt: new Date('2024-06-01'),
    };
    const membershipByPersonId = new Map<number, Membership>([[10, m]]);

    const entries = buildMemberEntriesFromAddresses({
      memberAddresses: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ] as const,
      peopleByAddress,
      spacesByAddress,
      membershipByPersonId,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].member_kind).toBe('person');
    if (entries[0].member_kind === 'person') {
      expect(entries[0].membership).toMatchObject({
        id: 1,
        person_id: 10,
        space_id: 1,
      });
      expect(entries[0].join_source).toBe('membership');
    }
    expect(entries[1].member_kind).toBe('space');
  });
});
