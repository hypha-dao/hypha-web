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

export function WalletActionsToolbar({
  basePath,
  disabled = false,
  className,
}: WalletActionsToolbarProps) {
  const tProfile = useTranslations('Profile');

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-end gap-2',
        className,
      )}
    >
      <Link
        className={cn('shrink-0', disabled && 'cursor-not-allowed')}
        href={disabled ? {} : `${basePath}/actions/buy-space-tokens`}
        scroll={false}
      >
        <Button
          className="h-10 whitespace-nowrap px-3 text-sm sm:px-4"
          disabled={disabled}
        >
          {tProfile('buySpaceTokens')}
        </Button>
      </Link>
      <Link
        className={cn('shrink-0', disabled && 'cursor-not-allowed')}
        href={disabled ? {} : `${basePath}/actions/purchase-hypha-tokens`}
        scroll={false}
      >
        <Button
          className="h-10 whitespace-nowrap px-3 text-sm sm:px-4"
          disabled={disabled}
        >
          {tProfile('buyHypha')}
        </Button>
      </Link>
      <Link
        className={cn('shrink-0', disabled && 'cursor-not-allowed')}
        href={disabled ? {} : `${basePath}/actions`}
        scroll={false}
      >
        <Button
          className="h-10 whitespace-nowrap px-3 text-sm sm:px-4"
          disabled={disabled}
        >
          {tProfile('actions')}
        </Button>
      </Link>
    </div>
  );
}
