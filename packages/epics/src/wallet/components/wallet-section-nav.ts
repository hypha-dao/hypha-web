import type { ElementType } from 'react';
import { Gift, Landmark, Wallet } from 'lucide-react';

export type WalletSectionNavKey = 'wallet' | 'banking' | 'rewards';

/** `MyWallet.tabs` label for each wallet menu item. */
export type WalletSectionLabelKey =
  | 'tabs.wallet'
  | 'tabs.banking'
  | 'tabs.rewards';

export type WalletSectionNavItem = {
  key: WalletSectionNavKey;
  labelKey: WalletSectionLabelKey;
  href: string;
  icon: ElementType;
};

/**
 * Wallet left rail and mobile secondary strip.
 * Wallet holds the action shortcuts, assets, and transactions.
 */
export function buildWalletSectionNavItems(
  basePath: string,
): WalletSectionNavItem[] {
  const base = basePath.replace(/\/$/, '');
  return [
    {
      key: 'wallet',
      labelKey: 'tabs.wallet',
      href: base,
      icon: Wallet,
    },
    {
      key: 'banking',
      labelKey: 'tabs.banking',
      href: `${base}/banking`,
      icon: Landmark,
    },
    {
      key: 'rewards',
      labelKey: 'tabs.rewards',
      href: `${base}/rewards`,
      icon: Gift,
    },
  ];
}

export function isWalletSectionNavActive(
  item: WalletSectionNavItem,
  pathname: string,
): boolean {
  if (item.key === 'wallet') {
    return (
      pathname === item.href ||
      pathname === `${item.href}/` ||
      pathname.startsWith(`${item.href}/actions`) ||
      pathname.startsWith(`${item.href}/transactions`) ||
      pathname.startsWith(`${item.href}/assets`)
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
