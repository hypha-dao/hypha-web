'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgePercent,
  Boxes,
  CirclePower,
  QrCode,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { useMe } from '@hypha-platform/core/client';
import { useFundWallet } from '../../treasury/hooks';
import { prepareWalletActionNavigation } from './open-wallet-action';

const shortcutIconClass = 'size-6 shrink-0';

type Shortcut = {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

function ShortcutCard({
  label,
  icon,
  href,
  external,
  onClick,
  disabled,
}: Omit<Shortcut, 'key'>) {
  const className = cn(
    'flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-none border border-border bg-background px-2 text-center text-foreground hover:bg-neutral-2',
    disabled && 'pointer-events-none opacity-40',
  );
  const body = (
    <>
      {icon}
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
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={className}
      aria-disabled={disabled || undefined}
      onClick={
        external
          ? undefined
          : () => {
              prepareWalletActionNavigation();
            }
      }
    >
      {body}
    </Link>
  );
}

function HyphaHIcon() {
  return (
    <Image
      src="/placeholder/hypha-tokens-icon.png"
      alt=""
      width={32}
      height={32}
      className={shortcutIconClass}
      aria-hidden
    />
  );
}

export function WalletShortcutCards({ basePath }: { basePath: string }) {
  const t = useTranslations('MyWallet');
  const { person } = useMe();
  const fundAddress = person?.address as `0x${string}` | undefined;
  const { fundWallet: depositFunds } = useFundWallet({
    address: fundAddress,
    title: t('depositFunds.title'),
    subtitle: t('depositFunds.subtitle'),
  });
  const { fundWallet: receiveFunds } = useFundWallet({
    address: fundAddress,
    title: t('receiveFunds.title'),
    subtitle: t('receiveFunds.subtitle'),
    defaultFundingMethod: 'manual',
  });
  const address = person?.address?.trim();

  const shortcuts: Shortcut[] = [
    {
      key: 'receive',
      label: t('shortcuts.receive'),
      icon: (
        <QrCode className={shortcutIconClass} strokeWidth={1.5} aria-hidden />
      ),
      onClick: () => {
        receiveFunds();
      },
      disabled: !address,
    },
    {
      key: 'deposit',
      label: t('shortcuts.deposit'),
      icon: (
        <ArrowDownToLine
          className={shortcutIconClass}
          strokeWidth={1.5}
          aria-hidden
        />
      ),
      onClick: () => {
        depositFunds();
      },
      disabled: !address,
    },
    {
      key: 'transfer',
      label: t('shortcuts.transfer'),
      icon: (
        <ArrowUpFromLine
          className={shortcutIconClass}
          strokeWidth={1.5}
          aria-hidden
        />
      ),
      href: `${basePath}/actions/transfer-funds`,
    },
    {
      key: 'redeem',
      label: t('shortcuts.redeem'),
      icon: (
        <BadgePercent
          className={shortcutIconClass}
          strokeWidth={1.5}
          aria-hidden
        />
      ),
      href: `${basePath}/actions/redeem-tokens`,
    },
    {
      key: 'buyHypha',
      label: t('shortcuts.buyHypha'),
      icon: <HyphaHIcon />,
      href: `${basePath}/actions/purchase-hypha-tokens`,
    },
    {
      key: 'buySpace',
      label: t('shortcuts.buySpace'),
      icon: (
        <Boxes className={shortcutIconClass} strokeWidth={1.5} aria-hidden />
      ),
      href: `${basePath}/actions/buy-space-tokens`,
    },
    {
      key: 'activate',
      label: t('shortcuts.activate'),
      icon: (
        <CirclePower
          className={shortcutIconClass}
          strokeWidth={1.5}
          aria-hidden
        />
      ),
      href: `${basePath}/actions/activate-spaces`,
    },
    {
      key: 'fundSpace',
      label: t('shortcuts.fundSpace'),
      icon: (
        <Wallet className={shortcutIconClass} strokeWidth={1.5} aria-hidden />
      ),
      href: `${basePath}/actions/fund-a-space`,
    },
  ];

  return (
    <nav
      aria-label={t('title')}
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8"
    >
      {shortcuts.map(({ key, ...shortcut }) => (
        <ShortcutCard key={key} {...shortcut} />
      ))}
    </nav>
  );
}
