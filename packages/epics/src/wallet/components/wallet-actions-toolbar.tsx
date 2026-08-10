'use client';

import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type WalletActionsToolbarProps = {
  basePath: string;
  disabled?: boolean;
  className?: string;
};

/**
 * The wallet's primary actions, so they keep the solid accent fill rather than
 * the quiet outline treatment used for banners and surrounding chrome.
 */
const ACTION_BUTTON_CLASS =
  'h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:px-4';

export function WalletActionsToolbar({
  basePath,
  disabled = false,
  className,
}: WalletActionsToolbarProps) {
  const tProfile = useTranslations('Profile');

  const actions = [
    { href: `${basePath}/actions/buy-space-tokens`, label: 'buySpaceTokens' },
    {
      href: `${basePath}/actions/purchase-hypha-tokens`,
      label: 'buyHypha',
    },
    { href: `${basePath}/actions`, label: 'actions' },
  ] as const;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto',
        className,
      )}
    >
      {actions.map(({ href, label }) =>
        disabled ? (
          <Button
            key={href}
            className={cn(ACTION_BUTTON_CLASS, 'cursor-not-allowed')}
            disabled
          >
            {tProfile(label)}
          </Button>
        ) : (
          <Button key={href} asChild className={ACTION_BUTTON_CLASS}>
            <Link href={href} scroll={false}>
              {tProfile(label)}
            </Link>
          </Button>
        ),
      )}
    </div>
  );
}
