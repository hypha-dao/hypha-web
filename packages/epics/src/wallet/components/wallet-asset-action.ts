import type { AssetItem } from '../../treasury/hooks/use-user-assets';

/**
 * Wallet action for a held asset. Transferable balances open send with the
 * token preselected; other types stay on the wallet screen.
 */
export function walletAssetActionHref(
  basePath: string,
  asset: Pick<AssetItem, 'address' | 'type' | 'value' | 'mutualCredit'>,
): string | null {
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
  return `${basePath.replace(/\/$/, '')}/actions/transfer-funds?${params}`;
}
