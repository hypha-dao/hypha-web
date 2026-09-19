import { describe, expect, it } from 'vitest';
import {
  combineNetworkTransactions,
  fillMonthlySeries,
  parseNetworkDashboardPayload,
  parseNetworkTreasurySnapshot,
  spaceIssuedTokenUsd,
  toCumulativeSeries,
  tokenRawToUsd,
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
        memberCount: 40,
        proposalCount: 20,
        transactionCount: 90,
        transactionsBeforeWindow: 8,
        spacesBeforeWindow: 4,
        membersBeforeWindow: 10,
        proposalsBeforeWindow: 1,
        spacesByMonth: [{ month: '2026-09', count: 2 }],
        membersByMonth: [{ month: '2026-08', count: 5 }],
        proposalsByMonth: [{ month: '2026-09', count: 3 }],
        transactionsByMonth: [{ month: '2026-09', count: 4 }],
      },
      {
        now: new Date('2026-09-18T10:00:00Z'),
      },
    );

    expect(stats.spaceCount).toBe(12);
    expect(stats.spacesThisMonth).toBe(2);
    expect(stats.membersThisMonth).toBe(0);
    expect(stats.proposalsThisMonth).toBe(3);
    expect(stats.transactionCount).toBe(90);
    expect(stats.transactionsThisMonth).toBe(4);
    expect(stats.transactionsCumulative.at(-1)).toBe(12);
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

describe('combineNetworkTransactions', () => {
  it('adds platform activity to on-chain transfers and votes', () => {
    const combined = combineNetworkTransactions(
      {
        transactionCount: 100,
        transactionsThisMonth: 8,
        months: ['2026-08', '2026-09'],
        transactionsCumulative: [40, 50],
      },
      {
        transferCount: 20,
        voteCount: 7,
        transactionCount: 27,
        transactionsThisMonth: 3,
        months: ['2026-08', '2026-09'],
        transactionsCumulative: [10, 15],
      },
    );

    expect(combined.transactionCount).toBe(127);
    expect(combined.transactionsThisMonth).toBe(11);
    expect(combined.transactionsCumulative).toEqual([50, 65]);
  });

  it('keeps activity totals when chain data is missing', () => {
    const combined = combineNetworkTransactions({
      transactionCount: 12,
      transactionsThisMonth: 2,
      months: ['2026-09'],
      transactionsCumulative: [12],
    });
    expect(combined.transactionCount).toBe(12);
    expect(combined.transactionsThisMonth).toBe(2);
  });
});

describe('parseNetworkTreasurySnapshot', () => {
  it('reads issued-token AUM and transfer totals', () => {
    const snapshot = parseNetworkTreasurySnapshot(
      {
        aumUsd: '1250.5',
        treasuryCount: 12,
        issuedTokenCount: 3,
        transferCount: 30,
        voteCount: 10,
        transactionCount: 40,
        transactionsBeforeWindow: 10,
        transactionsByMonth: [{ month: '2026-09', count: 4 }],
        tokens: [{ symbol: 'SEED', address: '0xabc', usd: 200 }],
        generatedAt: '2026-09-19T00:00:00.000Z',
      },
      { now: new Date('2026-09-18T10:00:00Z') },
    );

    expect(snapshot.aumUsd).toBe(1250.5);
    expect(snapshot.issuedTokenCount).toBe(3);
    expect(snapshot.transferCount).toBe(30);
    expect(snapshot.voteCount).toBe(10);
    expect(snapshot.transactionCount).toBe(40);
    expect(snapshot.transactionsThisMonth).toBe(4);
    expect(snapshot.transactionsCumulative.at(-1)).toBe(14);
    expect(snapshot.tokens).toEqual([
      { symbol: 'SEED', address: '0xabc', usd: 200 },
    ]);
  });
});

describe('spaceIssuedTokenUsd', () => {
  const rates = { USD: 1, EUR: 1.1, TZS: 1 / 2650 };

  it('values issued supply at the space-set reference price', () => {
    expect(spaceIssuedTokenUsd(2_000_000n, 6, 2, 'USD', rates)).toBe(4);
    expect(spaceIssuedTokenUsd(1_000_000n, 6, 2, 'EUR', rates)).toBeCloseTo(
      2.2,
      6,
    );
  });

  it('returns 0 without a positive reference price', () => {
    expect(spaceIssuedTokenUsd(1_000_000n, 6, 0, 'USD', rates)).toBe(0);
  });
});

describe('tokenRawToUsd', () => {
  it('converts raw token units with decimals and a USD price', () => {
    expect(tokenRawToUsd(1_500_000n, 6, 1)).toBe(1.5);
    expect(tokenRawToUsd(2n * 10n ** 18n, 18, 0.25)).toBe(0.5);
  });

  it('returns 0 for invalid inputs', () => {
    expect(tokenRawToUsd(0n, 6, 1)).toBe(0);
    expect(tokenRawToUsd(100n, 6, 0)).toBe(0);
    expect(tokenRawToUsd(100n, -1, 1)).toBe(0);
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
