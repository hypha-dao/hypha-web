'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type WalletActionsToolbarProps = {
  basePath: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Wallet secondary menu — Buy Hypha, Actions, Buy Space Tokens (vertical).
 */
export function WalletActionsToolbar({
  basePath,
  disabled = false,
  className,
}: WalletActionsToolbarProps) {
  const tProfile = useTranslations('Profile');
  const pathname = usePathname() ?? '';

  const actions = [
    {
      href: `${basePath}/actions/purchase-hypha-tokens`,
      label: 'buyHypha' as const,
    },
    { href: `${basePath}/actions`, label: 'actions' as const },
    {
      href: `${basePath}/actions/buy-space-tokens`,
      label: 'buySpaceTokens' as const,
    },
  ];

  return (
    <nav
      aria-label={tProfile('actions')}
      className={cn(
        'flex w-full min-w-0 flex-col items-stretch gap-0 border-b border-border',
        className,
      )}
    >
      {actions.map(({ href, label }) => {
        const active =
          label === 'actions'
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        const classNameForItem = cn(
          'w-full border-l-2 px-3 py-2 text-1 font-medium uppercase tracking-wide transition-colors',
          active
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
          disabled && 'pointer-events-none opacity-50',
        );
        return disabled ? (
          <span key={href} className={classNameForItem}>
            {tProfile(label)}
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={classNameForItem}
          >
            {tProfile(label)}
          </Link>
        );
      })}
    </nav>
  );
}
