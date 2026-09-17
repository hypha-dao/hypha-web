import { describe, expect, it } from 'vitest';

import { isHyphaPlatformSpace } from '../is-hypha-platform-space';
import {
  isPlaceholderPayingSpace,
  isPlaceholderSpaceTitle,
} from '../is-placeholder-space-title';
import {
  DEFAULT_HYPHA_PRICE_USD,
  allocateUsdByDuration,
  buildPayingSpacesTimeline,
  enumerateMonthKeys,
  hyphaAmountToUsd,
  nextMonthKey,
  reconstructCoverage,
  toMonthKey,
  usdcAmountToUsd,
} from '../paying-spaces-timeline';

describe('isHyphaPlatformSpace', () => {
  it('matches the hypha and hypha-platform slugs', () => {
    expect(isHyphaPlatformSpace({ slug: 'hypha' })).toBe(true);
    expect(isHyphaPlatformSpace({ slug: 'HYPHA' })).toBe(true);
    expect(isHyphaPlatformSpace({ slug: 'hypha-platform' })).toBe(true);
  });

  it('does not match a Hypha title when the slug is not canonical', () => {
    expect(isHyphaPlatformSpace({ slug: 'other' })).toBe(false);
  });

  it('rejects unrelated spaces', () => {
    expect(isHyphaPlatformSpace({ slug: 'hypha-energy' })).toBe(false);
  });
});

describe('isPlaceholderSpaceTitle', () => {
  it('matches test placeholders like Space 224', () => {
    expect(isPlaceholderSpaceTitle('Space 224')).toBe(true);
    expect(isPlaceholderSpaceTitle('space 1')).toBe(true);
    expect(isPlaceholderSpaceTitle('  SPACE  999  ')).toBe(true);
    expect(isPlaceholderSpaceTitle('Space\u00A0224')).toBe(true);
    expect(isPlaceholderSpaceTitle('\uFEFFSpace 224')).toBe(true);
  });

  it('keeps real organization titles', () => {
    expect(isPlaceholderSpaceTitle('Hypha')).toBe(false);
    expect(isPlaceholderSpaceTitle('SpaceX')).toBe(false);
    expect(isPlaceholderSpaceTitle('My Space 224')).toBe(false);
    expect(isPlaceholderSpaceTitle('Space')).toBe(false);
  });

  it('treats blank titles as the Space {id} fallback', () => {
    expect(isPlaceholderPayingSpace({ title: '', web3SpaceId: 224 })).toBe(
      true,
    );
    expect(isPlaceholderPayingSpace({ title: '   ', web3SpaceId: 1 })).toBe(
      true,
    );
    expect(
      isPlaceholderPayingSpace({ title: 'Space 224', web3SpaceId: 99 }),
    ).toBe(true);
    expect(isPlaceholderPayingSpace({ title: 'Hypha', web3SpaceId: 224 })).toBe(
      false,
    );
  });
});

describe('reconstructCoverage', () => {
  it('starts expired coverage from the payment timestamp', () => {
    const coverage = reconstructCoverage([
      { timestampSec: 1_000, spaceId: 7, durationDays: 2 },
    ]);
    expect(coverage.get(7)).toEqual([
      { startSec: 1_000, endSec: 1_000 + 2 * 86_400 },
    ]);
  });

  it('extends still-active coverage instead of opening a gap', () => {
    const firstEnd = 1_000 + 10 * 86_400;
    const coverage = reconstructCoverage([
      { timestampSec: 1_000, spaceId: 1, durationDays: 10 },
      { timestampSec: 1_000 + 2 * 86_400, spaceId: 1, durationDays: 5 },
    ]);
    expect(coverage.get(1)).toEqual([
      { startSec: 1_000, endSec: firstEnd + 5 * 86_400 },
    ]);
  });

  it('opens a new interval after expiry', () => {
    const coverage = reconstructCoverage([
      { timestampSec: 1_000, spaceId: 1, durationDays: 1 },
      { timestampSec: 1_000 + 5 * 86_400, spaceId: 1, durationDays: 1 },
    ]);
    expect(coverage.get(1)).toEqual([
      { startSec: 1_000, endSec: 1_000 + 86_400 },
      { startSec: 1_000 + 5 * 86_400, endSec: 1_000 + 6 * 86_400 },
    ]);
  });
});

describe('buildPayingSpacesTimeline', () => {
  it('returns an empty series when there are no payments', () => {
    expect(
      buildPayingSpacesTimeline({ events: [], nowSec: 1_700_000_000 }),
    ).toEqual({
      months: [],
      payingCount: [],
      paymentCount: [],
      paymentUsd: [],
      bySpace: [],
    });
  });

  it('counts a space as paying in every overlapped month from inception', () => {
    const start = Date.UTC(2024, 0, 15) / 1000;
    const nowSec = Date.UTC(2024, 2, 10) / 1000;
    const timeline = buildPayingSpacesTimeline({
      events: [{ timestampSec: start, spaceId: 42, durationDays: 60 }],
      nowSec,
    });

    expect(timeline.months).toEqual(['2024-01', '2024-02', '2024-03']);
    expect(timeline.payingCount).toEqual([1, 1, 1]);
    expect(timeline.paymentCount).toEqual([1, 0, 0]);
    expect(timeline.paymentUsd).toEqual([0, 0, 0]);
    expect(timeline.bySpace).toHaveLength(1);
    expect(timeline.bySpace[0]?.spaceId).toBe(42);
    expect(timeline.bySpace[0]?.paying).toEqual([true, true, true]);
    expect(timeline.bySpace[0]?.paymentUsd).toEqual([0, 0, 0]);
  });

  it('breaks down paying counts per space and per month', () => {
    const jan = Date.UTC(2025, 0, 2) / 1000;
    const feb = Date.UTC(2025, 1, 2) / 1000;
    const nowSec = Date.UTC(2025, 1, 20) / 1000;
    const timeline = buildPayingSpacesTimeline({
      events: [
        { timestampSec: jan, spaceId: 1, durationDays: 40 },
        { timestampSec: feb, spaceId: 2, durationDays: 10 },
      ],
      nowSec,
    });

    expect(timeline.months).toEqual(['2025-01', '2025-02']);
    expect(timeline.payingCount).toEqual([1, 2]);
    expect(timeline.paymentCount).toEqual([1, 1]);
    expect(timeline.paymentUsd).toEqual([0, 0]);

    const space1 = timeline.bySpace.find((row) => row.spaceId === 1);
    const space2 = timeline.bySpace.find((row) => row.spaceId === 2);
    expect(space1?.paying).toEqual([true, true]);
    expect(space2?.paying).toEqual([false, true]);
  });

  it('aggregates payment USD by month from inception', () => {
    const jan = Date.UTC(2025, 0, 2) / 1000;
    const feb = Date.UTC(2025, 1, 2) / 1000;
    const nowSec = Date.UTC(2025, 2, 1) / 1000;
    const timeline = buildPayingSpacesTimeline({
      events: [
        { timestampSec: jan, spaceId: 1, durationDays: 30, usdAmount: 11 },
        { timestampSec: jan, spaceId: 1, durationDays: 30, usdAmount: 11 },
        { timestampSec: feb, spaceId: 2, durationDays: 10, usdAmount: 3.67 },
      ],
      nowSec,
    });

    expect(timeline.months).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(timeline.paymentUsd).toEqual([22, 3.67, 0]);
    expect(
      timeline.bySpace.find((row) => row.spaceId === 1)?.paymentUsd,
    ).toEqual([22, 0, 0]);
    expect(
      timeline.bySpace.find((row) => row.spaceId === 2)?.paymentUsd,
    ).toEqual([0, 3.67, 0]);
  });
});

describe('payment amount conversion', () => {
  it('converts USDC 6-decimal amounts to USD', () => {
    expect(usdcAmountToUsd(11_000_000n)).toBe(11);
    expect(usdcAmountToUsd(367_000n)).toBe(0.367);
    expect(usdcAmountToUsd(0n)).toBe(0);
  });

  it('converts HYPHA using the on-chain $0.25 formula', () => {
    const oneHypha = 10n ** 18n;
    expect(hyphaAmountToUsd(oneHypha, DEFAULT_HYPHA_PRICE_USD)).toBe(0.25);
    const hyphaPerDay = 1_468_000_000_000_000_000n;
    expect(hyphaAmountToUsd(hyphaPerDay, DEFAULT_HYPHA_PRICE_USD)).toBe(0.367);
  });

  it('allocates a HYPHA batch by duration across spaces', () => {
    expect(allocateUsdByDuration([1, 2], [30, 10], 40)).toEqual([30, 10]);
    expect(allocateUsdByDuration([7], [15], 11)).toEqual([11]);
    expect(allocateUsdByDuration([1, 2], [0, 0], 10)).toEqual([5, 5]);
    expect(allocateUsdByDuration([], [], 10)).toEqual([]);
  });
});

describe('enumerateMonthKeys', () => {
  it('includes every month from the first payment through now', () => {
    expect(enumerateMonthKeys('2024-11', '2025-02')).toEqual([
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
    ]);
  });

  it('formats UTC month keys with a leading zero', () => {
    expect(toMonthKey(new Date(Date.UTC(2026, 8, 16)))).toBe('2026-09');
  });

  it('does not emit malformed keys such as 2024-01-extra', () => {
    expect(enumerateMonthKeys('2024-01-extra', '2024-03')).toEqual([]);
  });
});

describe('nextMonthKey', () => {
  it('advances a valid calendar month key', () => {
    expect(nextMonthKey('2024-12')).toBe('2025-01');
    expect(nextMonthKey('2025-01')).toBe('2025-02');
  });

  it('throws on invalid month keys', () => {
    expect(() => nextMonthKey('2024-13')).toThrow(/Invalid month key/);
    expect(() => nextMonthKey('not-a-month')).toThrow(/Invalid month key/);
    expect(() => nextMonthKey('2024')).toThrow(/Invalid month key/);
    expect(() => nextMonthKey('2024-01-extra')).toThrow(/Invalid month key/);
    expect(() => nextMonthKey('2024-1')).toThrow(/Invalid month key/);
  });
});
