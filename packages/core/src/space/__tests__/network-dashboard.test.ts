import { describe, expect, it } from 'vitest';
import {
  fillMonthlySeries,
  parseNetworkDashboardPayload,
  toCumulativeSeries,
  toNetworkPayingSnapshot,
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

describe('parseNetworkDashboardPayload', () => {
  it('coerces postgres json and builds cumulative investor stats', () => {
    const stats = parseNetworkDashboardPayload(
      {
        spaceCount: '12',
        activeSpaceCount: 8,
        memberCount: 40,
        proposalCount: 20,
        spacesBeforeWindow: 4,
        membersBeforeWindow: 10,
        proposalsBeforeWindow: 1,
        spacesByMonth: [{ month: '2026-09', count: 2 }],
        membersByMonth: [{ month: '2026-08', count: 5 }],
        proposalsByMonth: [{ month: '2026-09', count: 3 }],
      },
      {
        now: new Date('2026-09-18T10:00:00Z'),
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

describe('toNetworkPayingSnapshot', () => {
  it('keeps summary totals and monthly paying series', () => {
    expect(
      toNetworkPayingSnapshot({
        summary: {
          currentlyPaying: 7,
          everPaid: 11,
          paymentEvents: 40,
          paymentUsd: 1234.56,
        },
        monthly: [
          {
            month: '2026-08',
            payingSpaces: 5,
            paymentCount: 3,
            paymentUsd: 200,
          },
          { month: 'bad', payingSpaces: 9, paymentUsd: 1 },
        ],
      }),
    ).toEqual({
      currentlyPaying: 7,
      everPaid: 11,
      paymentEvents: 40,
      paymentUsd: 1234.56,
      months: [
        {
          month: '2026-08',
          payingSpaces: 5,
          paymentCount: 3,
          paymentUsd: 200,
        },
      ],
    });
  });
});
