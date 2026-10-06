/** Named donut/legend rows on the Overview Distribution tab. */
export const DISTRIBUTION_CHART_NAMED_HOLDER_LIMIT = 8;

/**
 * Rank holders by descending balance. Equal balances use a lowercased address
 * so the pre-name-resolve ranking and the final chart sort pick the same top N.
 */
export function compareByBalanceThenAddress(
  leftBalance: bigint,
  leftAddress: string | null | undefined,
  rightBalance: bigint,
  rightAddress: string | null | undefined,
): number {
  const diff = rightBalance - leftBalance;
  if (diff > 0n) return 1;
  if (diff < 0n) return -1;
  return (leftAddress ?? '')
    .toLowerCase()
    .localeCompare((rightAddress ?? '').toLowerCase());
}

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
