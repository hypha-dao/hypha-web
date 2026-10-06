/** Named donut/legend rows on the Overview Distribution tab. */
export const DISTRIBUTION_CHART_NAMED_HOLDER_LIMIT = 8;

/**
 * Export expands every wallet and must not add a chart "Other" bucket.
 * Charts expand wallets only to rank them, then cap named rows and put the
 * tail in Other.
 */
export function shouldIncludeChartOtherBucket(input: {
  expandUnknownHolders: boolean;
  holderLimit?: number;
}): boolean {
  if (!input.expandUnknownHolders) return true;
  return input.holderLimit != null;
}
