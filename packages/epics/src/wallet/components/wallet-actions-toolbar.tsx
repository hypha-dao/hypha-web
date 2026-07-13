'use client';

import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
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
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Link
        className={disabled ? 'cursor-not-allowed' : ''}
        href={disabled ? {} : `${basePath}/actions/buy-space-tokens`}
        scroll={false}
      >
        <Button disabled={disabled}>{tProfile('buySpaceTokens')}</Button>
      </Link>
      <Link
        className={disabled ? 'cursor-not-allowed' : ''}
        href={disabled ? {} : `${basePath}/actions/purchase-hypha-tokens`}
        scroll={false}
      >
        <Button disabled={disabled}>{tProfile('buyHypha')}</Button>
      </Link>
      <Link
        className={disabled ? 'cursor-not-allowed' : ''}
        href={disabled ? {} : `${basePath}/actions`}
        scroll={false}
      >
        <Button disabled={disabled}>{tProfile('actions')}</Button>
      </Link>
    </div>
  );
}
