import { describe, expect, it } from 'vitest';

import {
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
