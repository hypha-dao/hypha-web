import { describe, expect, it } from 'vitest';
import {
  buildCumulativeSeries,
  countCreatedInMonth,
  countInMonth,
  cumulativePlotDomain,
  recentMonthKeys,
} from '../network-growth';

const september = new Date(Date.UTC(2026, 8, 15));

describe('recentMonthKeys', () => {
  it('returns twelve UTC months ending at the current month', () => {
    expect(recentMonthKeys(september)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });
});

describe('buildCumulativeSeries', () => {
  it('keeps history before the window in the baseline', () => {
    const series = buildCumulativeSeries(
      [
        { month: '2024-03', count: 10 },
        { month: '2025-10', count: 2 },
        { month: '2026-09', count: 3 },
      ],
      september,
    );

    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: '2025-10', cumulative: 12 });
    expect(series[1]).toEqual({ month: '2025-11', cumulative: 12 });
    expect(series.at(-1)).toEqual({ month: '2026-09', cumulative: 15 });
  });

  it('ignores rows that are not a month key', () => {
    const series = buildCumulativeSeries(
      [
        { month: 'nope', count: 9 },
        { month: '2026-09', count: 1 },
      ],
      september,
    );
    expect(series.at(-1)?.cumulative).toBe(1);
  });
});

describe('countInMonth', () => {
  it('sums only the current UTC month', () => {
    expect(
      countInMonth(
        [
          { month: '2026-08', count: 4 },
          { month: '2026-09', count: 2 },
        ],
        september,
      ),
    ).toBe(2);
  });
});

describe('countCreatedInMonth', () => {
  it('counts timestamps that fall in the current UTC month', () => {
    expect(
      countCreatedInMonth(
        [
          new Date(Date.UTC(2026, 8, 1)),
          '2026-09-28T12:00:00.000Z',
          '2026-08-31T23:00:00.000Z',
          null,
          'not-a-date',
        ],
        september,
      ),
    ).toBe(2);
  });
});

describe('cumulativePlotDomain', () => {
  it('starts at zero when the series still rises from a low base', () => {
    const domain = cumulativePlotDomain([50, 90, 165]);
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThanOrEqual(165);
  });

  it('lifts the floor when twelve months sit in a thin band', () => {
    const domain = cumulativePlotDomain([600, 620, 640]);
    expect(domain.min).toBeGreaterThan(0);
    expect(domain.min).toBeLessThan(600);
    expect(domain.max).toBeGreaterThanOrEqual(640);
  });
});
