import type { ElementType } from 'react';
import { Coins, HandCoins, Zap } from 'lucide-react';

export type WalletSectionNavKey = 'buy-hypha' | 'actions' | 'buy-space-tokens';

export type WalletSectionNavItem = {
  key: WalletSectionNavKey;
  /** Profile i18n key under `Profile`. */
  labelKey: 'buyHypha' | 'actions' | 'buySpaceTokens';
  href: string;
  icon: ElementType;
  /** Exact path match only (Actions index, not nested buy routes). */
  exact?: boolean;
};

/**
 * Wallet secondary nav — left icon rail (desktop) and mobile secondary strip.
 * Order: Buy Hypha → Actions → Buy Space Tokens.
 */
export function buildWalletSectionNavItems(
  basePath: string,
): WalletSectionNavItem[] {
  const base = basePath.replace(/\/$/, '');
  return [
    {
      key: 'buy-hypha',
      labelKey: 'buyHypha',
      href: `${base}/actions/purchase-hypha-tokens`,
      icon: Coins,
    },
    {
      key: 'actions',
      labelKey: 'actions',
      href: `${base}/actions`,
      icon: Zap,
      exact: true,
    },
    {
      key: 'buy-space-tokens',
      labelKey: 'buySpaceTokens',
      href: `${base}/actions/buy-space-tokens`,
      icon: HandCoins,
    },
  ];
}

export function isWalletSectionNavActive(
  item: WalletSectionNavItem,
  pathname: string,
): boolean {
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
