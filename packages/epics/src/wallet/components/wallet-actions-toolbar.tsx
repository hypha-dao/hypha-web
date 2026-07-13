'use client';

import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type WalletActionsToolbarProps = {
  basePath: string;
  disabled?: boolean;
};

export function WalletActionsToolbar({
  basePath,
  disabled = false,
}: WalletActionsToolbarProps) {
  const tProfile = useTranslations('Profile');

  return (
    <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:items-center sm:justify-end xl:justify-end">
      <Link
        className={cn(
          'min-w-0 flex-1 sm:flex-none',
          disabled && 'cursor-not-allowed',
        )}
        href={disabled ? {} : `${basePath}/actions/buy-space-tokens`}
        scroll={false}
      >
        <Button className="w-full sm:w-auto" disabled={disabled}>
          {tProfile('buySpaceTokens')}
        </Button>
      </Link>
      <Link
        className={cn(
          'min-w-0 flex-1 sm:flex-none',
          disabled && 'cursor-not-allowed',
        )}
        href={disabled ? {} : `${basePath}/actions/purchase-hypha-tokens`}
        scroll={false}
      >
        <Button className="w-full sm:w-auto" disabled={disabled}>
          {tProfile('buyHypha')}
        </Button>
      </Link>
      <Link
        className={cn(
          'min-w-0 flex-1 sm:flex-none',
          disabled && 'cursor-not-allowed',
        )}
        href={disabled ? {} : `${basePath}/actions`}
        scroll={false}
      >
        <Button className="w-full sm:w-auto" disabled={disabled}>
          {tProfile('actions')}
        </Button>
      </Link>
    </div>
  );
}
