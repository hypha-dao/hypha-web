import { describe, expect, it } from 'vitest';
import {
  fillMonthlySeries,
  mergeNamedCounts,
  parseNetworkDashboardPayload,
  toCumulativeSeries,
  utcMonthKeys,
} from '../network-dashboard';

describe('utcMonthKeys', () => {
  it('returns 12 UTC month keys ending at the current month', () => {
    const keys = utcMonthKeys(12, new Date('2026-09-18T10:00:00Z'));
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe('2025-10');
    expect(keys.at(-1)).toBe('2026-09');
  });
});

describe('fillMonthlySeries', () => {
  it('fills missing months with zero and sums duplicates', () => {
    expect(
      fillMonthlySeries(
        [
          { month: '2026-01', count: 2 },
          { month: '2026-01', count: '3' as unknown as number },
          { month: '2026-03', count: 4 },
        ],
        ['2026-01', '2026-02', '2026-03'],
      ),
    ).toEqual([5, 0, 4]);
  });
});

describe('toCumulativeSeries', () => {
  it('adds a baseline then accumulates month by month', () => {
    expect(toCumulativeSeries([2, 0, 3], 10)).toEqual([12, 12, 15]);
  });
});

describe('mergeNamedCounts', () => {
  it('canonicalizes, merges, and keeps the top names', () => {
    expect(
      mergeNamedCounts(
        [
          { name: 'Contribution', count: 4 },
          { name: 'Contribución', count: 2 },
          { name: 'Invite', count: 9 },
          { name: 'Other', count: 1 },
        ],
        (name) => (name.startsWith('Contrib') ? 'Contribution' : name),
        2,
      ),
    ).toEqual([
      { name: 'Invite', count: 9 },
      { name: 'Contribution', count: 6 },
    ]);
  });
});

describe('parseNetworkDashboardPayload', () => {
  it('coerces postgres json and builds cumulative investor stats', () => {
    const stats = parseNetworkDashboardPayload(
      {
        spaceCount: '12',
        activeSpaceCount: 8,
        memberCount: 40,
        proposalCount: 20,
        agreementCount: 7,
        tokenCount: 5,
        mappedSpaceCount: 3,
        activityLast24h: 9,
        spacesBeforeWindow: 4,
        membersBeforeWindow: 10,
        proposalsBeforeWindow: 1,
        spacesByMonth: [{ month: '2026-09', count: 2 }],
        membersByMonth: [{ month: '2026-08', count: 5 }],
        proposalsByMonth: [{ month: '2026-09', count: 3 }],
        tokensByType: [
          { name: 'utility', count: 3 },
          { name: 'voice', count: 2 },
        ],
        proposalsByLabel: [
          { name: 'Invite', count: 4 },
          { name: 'Invitación', count: 1 },
        ],
      },
      {
        now: new Date('2026-09-18T10:00:00Z'),
        canonicalizeProposalLabel: (label) =>
          label === 'Invitación' ? 'Invite' : label,
      },
    );

    expect(stats.spaceCount).toBe(12);
    expect(stats.spacesThisMonth).toBe(2);
    expect(stats.membersThisMonth).toBe(0);
    expect(stats.proposalsThisMonth).toBe(3);
    expect(stats.months.at(-1)).toBe('2026-09');
    expect(stats.spacesCumulative.at(-1)).toBe(6);
    expect(stats.membersCumulative.at(-2)).toBe(15);
    expect(stats.membersCumulative.at(-1)).toBe(15);
    expect(stats.proposalsByType[0]).toEqual({ name: 'Invite', count: 5 });
    expect(stats.tokensByType.map((item) => item.name)).toEqual([
      'utility',
      'voice',
    ]);
  });

  it('parses a json string payload', () => {
    const stats = parseNetworkDashboardPayload(
      JSON.stringify({ spaceCount: 3 }),
      { now: new Date('2026-01-01T00:00:00Z') },
    );
    expect(stats.spaceCount).toBe(3);
    expect(stats.spacesCumulative).toHaveLength(12);
  });
});
