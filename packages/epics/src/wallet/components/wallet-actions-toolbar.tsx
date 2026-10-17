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
 * Wallet secondary menu — Buy Space Tokens, Buy Hypha, Actions.
 * Replaces the solid CTA buttons on larger screens (and keeps the same
 * destinations as a quiet strip on smaller ones).
 */
export function WalletActionsToolbar({
  basePath,
  disabled = false,
  className,
}: WalletActionsToolbarProps) {
  const tProfile = useTranslations('Profile');
  const pathname = usePathname() ?? '';

  const actions = [
    { href: `${basePath}/actions/buy-space-tokens`, label: 'buySpaceTokens' },
    {
      href: `${basePath}/actions/purchase-hypha-tokens`,
      label: 'buyHypha',
    },
    { href: `${basePath}/actions`, label: 'actions' },
  ] as const;

  return (
    <nav
      aria-label={tProfile('actions')}
      className={cn(
        'flex min-w-0 flex-nowrap items-end gap-0 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {actions.map(({ href, label }) => {
        const active =
          pathname === href ||
          (label === 'actions'
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`));
        const classNameForItem = cn(
          'shrink-0 border-b-2 px-3 pb-2 text-1 font-medium uppercase tracking-wide transition-colors',
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
