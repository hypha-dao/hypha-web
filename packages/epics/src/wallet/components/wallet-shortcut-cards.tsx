'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpFromLine,
  BadgePercent,
  Boxes,
  CirclePower,
  Gem,
  RefreshCcw,
  WalletCards,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { useMe } from '@hypha-platform/core/client';
import { useFundWallet } from '../../treasury/hooks';

const MIGRATE_HYPHA_TOKENS_URL =
  process.env.NEXT_PUBLIC_MIGRATE_HYPHA_TOKENS_URL ??
  'https://hypha-react-demo.vercel.app';

type Shortcut = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  external?: boolean;
  featured?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

function ShortcutCard({
  label,
  icon: Icon,
  href,
  external,
  featured,
  onClick,
  disabled,
}: Omit<Shortcut, 'key'>) {
  const className = cn(
    'flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 border px-1.5 py-1.5 text-center',
    featured
      ? 'border-foreground bg-foreground text-background'
      : 'border-border bg-background text-foreground hover:bg-neutral-2',
    disabled && 'pointer-events-none opacity-40',
  );
  const body = (
    <>
      <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      <span className="max-w-full text-[11px] leading-tight">{label}</span>
    </>
  );

  if (onClick || !href) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled || !onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      href={href}
      scroll={external ? undefined : false}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={className}
      aria-disabled={disabled || undefined}
    >
      {body}
    </Link>
  );
}

export function WalletShortcutCards({ basePath }: { basePath: string }) {
  const t = useTranslations('MyWallet');
  const { person } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}` | undefined,
  });
  const address = person?.address?.trim();

  const shortcuts: Shortcut[] = [
    {
      key: 'deposit',
      label: t('shortcuts.deposit'),
      icon: WalletCards,
      onClick: () => {
        fundWallet();
      },
      disabled: !address,
    },
    {
      key: 'transfer',
      label: t('shortcuts.transfer'),
      icon: ArrowUpFromLine,
      href: `${basePath}/actions/transfer-funds`,
    },
    {
      key: 'redeem',
      label: t('shortcuts.redeem'),
      icon: BadgePercent,
      href: `${basePath}/actions/redeem-tokens`,
    },
    {
      key: 'buyHypha',
      label: t('shortcuts.buyHypha'),
      icon: Gem,
      href: `${basePath}/actions/purchase-hypha-tokens`,
      featured: true,
    },
    {
      key: 'buySpace',
      label: t('shortcuts.buySpace'),
      icon: Boxes,
      href: `${basePath}/actions/buy-space-tokens`,
    },
    {
      key: 'activate',
      label: t('shortcuts.activate'),
      icon: CirclePower,
      href: `${basePath}/actions/activate-spaces`,
    },
    {
      key: 'migrate',
      label: t('shortcuts.migrate'),
      icon: RefreshCcw,
      href: address ? `${MIGRATE_HYPHA_TOKENS_URL}/${address}` : undefined,
      external: true,
      disabled: !address,
    },
  ];

  return (
    <nav
      aria-label={t('title')}
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7"
    >
      {shortcuts.map(({ key, ...shortcut }) => (
        <ShortcutCard key={key} {...shortcut} />
      ))}
    </nav>
  );
}
