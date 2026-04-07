import { describe, expect, it } from 'vitest';
import {
  buildMemberEntriesFromAddresses,
  mergeJoinEventTimesByAddress,
} from '../get-space-members-roster-helpers';
import type { Space } from '../../types';
import type { Membership } from '@hypha-platform/storage-postgres';

describe('buildMemberEntriesFromAddresses', () => {
  it('maps on-chain order to person then space entries with full membership snake fields', () => {
    const p1 = {
      id: 10,
      slug: 'alice',
      links: [],
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
    const first = entries[0]!;
    const second = entries[1]!;
    expect(first.member_kind).toBe('person');
    if (first.member_kind === 'person') {
      expect(first.membership).toMatchObject({
        id: 1,
        person_id: 10,
        space_id: 1,
      });
      expect(first.join_source).toBe('membership');
    }
    expect(second.member_kind).toBe('space');
  });

  it('uses joinSpace event time when memberships row is missing (UI parity)', () => {
    const addr = '0x1111111111111111111111111111111111111111';
    const p1 = {
      id: 10,
      slug: 'alice',
      links: [],
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    };
    const peopleByAddress = new Map([[addr, p1]]);
    const eventJoin = new Map([
      [addr.toLowerCase(), new Date('2026-04-03T09:23:14.000Z')],
    ]);

    const entries = buildMemberEntriesFromAddresses({
      memberAddresses: [addr as `0x${string}`],
      peopleByAddress,
      spacesByAddress: new Map(),
      membershipByPersonId: new Map(),
      eventJoinTimeByAddress: eventJoin,
    });

    expect(entries).toHaveLength(1);
    const e = entries[0]!;
    expect(e.member_kind).toBe('person');
    if (e.member_kind === 'person') {
      expect(e.membership).toBeNull();
      expect(e.join_source).toBe('event');
      expect(e.joined_at).toBe('2026-04-03T09:23:14.000Z');
    }
  });
});

describe('mergeJoinEventTimesByAddress', () => {
  it('keeps earliest createdAt per member address', () => {
    const map = mergeJoinEventTimesByAddress([
      {
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        parameters: { memberAddress: '0xAbC' },
      },
      {
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        parameters: { memberAddress: '0xabc' },
      },
    ]);
    expect(map.get('0xabc')?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
