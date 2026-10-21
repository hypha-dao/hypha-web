import type { AssetItem } from '../../treasury/hooks/use-user-assets';

/** Base HYPHA. It is locked, so the wallet opens buy instead of send. */
export const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

export function isHyphaAsset(asset: {
  symbol?: string | null;
  address?: string | null;
}): boolean {
  if (asset.symbol?.trim().toUpperCase() === 'HYPHA') return true;
  const address = asset.address?.trim().toLowerCase();
  return address === HYPHA_TOKEN_ADDRESS.toLowerCase();
}

/**
 * Wallet action for a held asset. HYPHA opens buy because the token is locked.
 * Other transferable balances open send with the token preselected.
 */
export function walletAssetActionHref(
  basePath: string,
  asset: Pick<
    AssetItem,
    'address' | 'symbol' | 'type' | 'value' | 'mutualCredit'
  >,
): string | null {
  const root = basePath.replace(/\/$/, '');
  if (isHyphaAsset(asset) && !root.endsWith('/token')) {
    return `${root}/actions/purchase-hypha-tokens`;
  }

  const address = asset.address?.trim();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  if (asset.type === 'ownership' || asset.type === 'voice') return null;

  const hasBalance = (asset.value ?? 0) > 0;
  const canDrawCredit = Boolean(
    asset.mutualCredit?.creditEligible &&
      asset.mutualCredit.creditLimitLeft > 0,
  );
  if (!hasBalance && !canDrawCredit) return null;

  const params = new URLSearchParams({ token: address });
  return `${root}/actions/transfer-funds?${params}`;
}
