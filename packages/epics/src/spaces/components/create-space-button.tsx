'use client';

import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { getOnboardingPath } from '../../common/get-path-function';

type CreateSpaceButtonProps = {
  lang: Locale;
  isAuthenticated: boolean;
  className?: string;
  buttonClassName?: string;
};

export function CreateSpaceButton({
  lang,
  isAuthenticated,
  className,
  buttonClassName,
}: CreateSpaceButtonProps) {
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');

  const button = (
    <Button disabled={!isAuthenticated} size="sm" className={buttonClassName}>
      <PlusIcon />
      {tSpaces('createSpace')}
    </Button>
  );

  if (!isAuthenticated) {
    return (
      <span
        className={cn('inline-flex cursor-not-allowed', className)}
        title={tCommon('signIn')}
      >
        {button}
      </span>
    );
  }

  return (
    <Link className={className} href={getOnboardingPath(lang)} scroll={false}>
      {button}
    </Link>
  );
}
