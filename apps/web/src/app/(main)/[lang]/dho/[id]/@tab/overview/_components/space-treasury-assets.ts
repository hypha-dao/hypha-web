export type SpaceTreasuryAsset = {
  symbol: string;
  value: number;
  usdEqual: number;
  address: string;
};

type SpaceTreasuryAssetInput = {
  symbol?: string;
  value?: number;
  usdEqual?: number;
  address?: string;
};

/**
 * Map the space assets API payload into overview cards.
 * Keep zero-balance rows — issued tokens often sit at 0 until funded, and the
 * treasury panel + holder graphs should still appear once a card exists.
 */
export function mapSpaceTreasuryAssets(
  assets: readonly SpaceTreasuryAssetInput[] | null | undefined,
): SpaceTreasuryAsset[] {
  return (assets ?? []).flatMap((asset) => {
    const symbol = asset.symbol?.trim();
    if (!symbol) return [];
    const value =
      typeof asset.value === 'number' && Number.isFinite(asset.value)
        ? asset.value
        : 0;
    const usdEqual =
      typeof asset.usdEqual === 'number' && Number.isFinite(asset.usdEqual)
        ? asset.usdEqual
        : 0;
    return [
      {
        symbol,
        value,
        usdEqual,
        address: asset.address ?? '',
      },
    ];
  });
}

/** Pie share for overview distribution; equal slices when every balance is 0. */
export function spaceTreasuryDistributionShare(
  value: number,
  total: number,
  tokenCount: number,
): number {
  if (total > 0) return value / total;
  if (tokenCount <= 0) return 0;
  return 1 / tokenCount;
}
