import type { ElementType } from 'react';
import { ArrowLeftRight, Gift, Landmark, Layers, Wallet } from 'lucide-react';

export type WalletSectionNavKey =
  | 'assets'
  | 'transactions'
  | 'wallet'
  | 'banking'
  | 'rewards';

/** `MyWallet.tabs` label for each wallet menu item. */
export type WalletSectionLabelKey =
  | 'tabs.assets'
  | 'tabs.transactions'
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
 * Wallet (the action shortcuts) is the default screen at `basePath`.
 */
export function buildWalletSectionNavItems(
  basePath: string,
): WalletSectionNavItem[] {
  const base = basePath.replace(/\/$/, '');
  return [
    {
      key: 'assets',
      labelKey: 'tabs.assets',
      href: `${base}/assets`,
      icon: Layers,
    },
    {
      key: 'transactions',
      labelKey: 'tabs.transactions',
      href: `${base}/transactions`,
      icon: ArrowLeftRight,
    },
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
      pathname.startsWith(`${item.href}/actions`)
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
