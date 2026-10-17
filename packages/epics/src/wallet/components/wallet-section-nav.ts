import type { ElementType } from 'react';
import {
  ArrowLeftRight,
  Gift,
  HandCoins,
  Rocket,
  Send,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

const MIGRATE_HYPHA_TOKENS_URL =
  process.env.NEXT_PUBLIC_MIGRATE_HYPHA_TOKENS_URL ??
  'https://hypha-react-demo.vercel.app';

export type WalletSectionNavKey =
  | 'deposit'
  | 'transfer'
  | 'redeem'
  | 'buy-hypha'
  | 'buy-space-tokens'
  | 'activate'
  | 'migrate';

/** `ProfileActions` title for each wallet action. */
export type WalletSectionLabelKey =
  | 'actions.depositFunds.title'
  | 'actions.transferFunds.title'
  | 'actions.redeemTokens.title'
  | 'actions.buyHyphaTokensRewards.title'
  | 'actions.buySpaceTokens.title'
  | 'actions.activateSpaces.title'
  | 'actions.migrateHyphaTokens.title';

export type WalletSectionNavItem = {
  key: WalletSectionNavKey;
  labelKey: WalletSectionLabelKey;
  href?: string;
  external?: boolean;
  /** Opens the receive-funds modal instead of a route. */
  fundWallet?: boolean;
  disabled?: boolean;
  icon: ElementType;
};

/**
 * Wallet secondary nav — left icon rail (desktop) and mobile secondary strip.
 * Same actions as the wallet actions list. The actions hub is not a menu item.
 */
export function buildWalletSectionNavItems(
  basePath: string,
  options?: { walletAddress?: string | null },
): WalletSectionNavItem[] {
  const base = basePath.replace(/\/$/, '');
  const actions = `${base}/actions`;
  const address = options?.walletAddress?.trim() ?? '';
  return [
    {
      key: 'deposit',
      labelKey: 'actions.depositFunds.title',
      icon: HandCoins,
      fundWallet: true,
      disabled: address.length === 0,
    },
    {
      key: 'transfer',
      labelKey: 'actions.transferFunds.title',
      href: `${actions}/transfer-funds`,
      icon: Send,
    },
    {
      key: 'redeem',
      labelKey: 'actions.redeemTokens.title',
      href: `${actions}/redeem-tokens`,
      icon: Gift,
    },
    {
      key: 'buy-hypha',
      labelKey: 'actions.buyHyphaTokensRewards.title',
      href: `${actions}/purchase-hypha-tokens`,
      icon: Sparkles,
    },
    {
      key: 'buy-space-tokens',
      labelKey: 'actions.buySpaceTokens.title',
      href: `${actions}/buy-space-tokens`,
      icon: ShoppingBag,
    },
    {
      key: 'activate',
      labelKey: 'actions.activateSpaces.title',
      href: `${actions}/activate-spaces`,
      icon: Rocket,
    },
    {
      key: 'migrate',
      labelKey: 'actions.migrateHyphaTokens.title',
      href: address ? `${MIGRATE_HYPHA_TOKENS_URL}/${address}` : undefined,
      external: true,
      disabled: address.length === 0,
      icon: ArrowLeftRight,
    },
  ];
}

export function isWalletSectionNavActive(
  item: WalletSectionNavItem,
  pathname: string,
): boolean {
  if (!item.href || item.external || item.fundWallet) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
