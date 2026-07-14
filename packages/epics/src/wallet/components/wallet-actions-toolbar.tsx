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
        'flex min-w-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto',
        className,
      )}
    >
      {disabled ? (
        <Button
          className="h-10 shrink-0 cursor-not-allowed whitespace-nowrap px-3 text-sm sm:px-4"
          disabled
        >
          {tProfile('buySpaceTokens')}
        </Button>
      ) : (
        <Button
          asChild
          className="h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:px-4"
        >
          <Link href={`${basePath}/actions/buy-space-tokens`} scroll={false}>
            {tProfile('buySpaceTokens')}
          </Link>
        </Button>
      )}
      {disabled ? (
        <Button
          className="h-10 shrink-0 cursor-not-allowed whitespace-nowrap px-3 text-sm sm:px-4"
          disabled
        >
          {tProfile('buyHypha')}
        </Button>
      ) : (
        <Button
          asChild
          className="h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:px-4"
        >
          <Link
            href={`${basePath}/actions/purchase-hypha-tokens`}
            scroll={false}
          >
            {tProfile('buyHypha')}
          </Link>
        </Button>
      )}
      {disabled ? (
        <Button
          className="h-10 shrink-0 cursor-not-allowed whitespace-nowrap px-3 text-sm sm:px-4"
          disabled
        >
          {tProfile('actions')}
        </Button>
      ) : (
        <Button
          asChild
          className="h-10 shrink-0 whitespace-nowrap px-3 text-sm sm:px-4"
        >
          <Link href={`${basePath}/actions`} scroll={false}>
            {tProfile('actions')}
          </Link>
        </Button>
      )}
    </div>
  );
}
