'use client';

import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import { useAuthentication } from '@hypha-platform/authentication';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { getOnboardingPath } from '../../common/get-path-function';

type CreateSpaceButtonProps = {
  lang: Locale;
  className?: string;
  buttonClassName?: string;
};

export function CreateSpaceButton({
  lang,
  className,
  buttonClassName,
}: CreateSpaceButtonProps) {
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');
  const { isAuthenticated } = useAuthentication();

  return (
    <Link
      className={cn(!isAuthenticated && 'cursor-not-allowed', className)}
      title={!isAuthenticated ? tCommon('signIn') : undefined}
      href={isAuthenticated ? getOnboardingPath(lang) : {}}
      scroll={false}
    >
      <Button disabled={!isAuthenticated} className={buttonClassName}>
        <PlusIcon />
        {tSpaces('createSpace')}
      </Button>
    </Link>
  );
}
