import { describe, expect, it } from 'vitest';

import {
  compareByBalanceThenAddress,
  DISTRIBUTION_CHART_NAMED_HOLDER_LIMIT,
  shouldIncludeChartOtherBucket,
} from '../distribution-chart-holders';

describe('DISTRIBUTION_CHART_NAMED_HOLDER_LIMIT', () => {
  it('keeps eight named slices so Other can be the ninth', () => {
    expect(DISTRIBUTION_CHART_NAMED_HOLDER_LIMIT).toBe(8);
  });
});

describe('shouldIncludeChartOtherBucket', () => {
  it('adds Other for roster-only charts', () => {
    expect(shouldIncludeChartOtherBucket({ expandUnknownHolders: false })).toBe(
      true,
    );
    expect(
      shouldIncludeChartOtherBucket({
        expandUnknownHolders: false,
        holderLimit: 8,
      }),
    ).toBe(true);
  });

  it('adds Other when expanding wallets but capping named rows', () => {
    expect(
      shouldIncludeChartOtherBucket({
        expandUnknownHolders: true,
        holderLimit: 8,
      }),
    ).toBe(true);
  });

  it('omits Other for a full per-wallet export', () => {
    expect(shouldIncludeChartOtherBucket({ expandUnknownHolders: true })).toBe(
      false,
    );
  });
});

describe('compareByBalanceThenAddress', () => {
  it('ranks higher balances first and ties on lowercased address', () => {
    expect(compareByBalanceThenAddress(1n, '0xbb', 2n, '0xaa')).toBeGreaterThan(
      0,
    );
    expect(compareByBalanceThenAddress(2n, '0xbb', 1n, '0xaa')).toBeLessThan(0);

    const unnamed = '0xAa00000000000000000000000000000000000002';
    const named = '0xbb00000000000000000000000000000000000001';
    expect(compareByBalanceThenAddress(10n, unnamed, 10n, named)).toBeLessThan(
      0,
    );
    expect(
      [...[{ address: named }, { address: unnamed }]].sort((left, right) =>
        compareByBalanceThenAddress(10n, left.address, 10n, right.address),
      ),
    ).toEqual([{ address: unnamed }, { address: named }]);
  });
});
