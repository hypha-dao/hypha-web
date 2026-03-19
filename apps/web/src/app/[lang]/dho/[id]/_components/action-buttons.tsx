'use client';

import Link from 'next/link';
import { GearIcon, PlusIcon } from '@radix-ui/react-icons';
import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';
import {
  PATH_SELECT_CREATE_ACTION,
  PATH_SELECT_SETTINGS_ACTION,
} from '@web/app/constants';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from '@hypha-platform/epics';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface ActionButtonsProps {
  web3SpaceId?: number;
}

export const ActionButtons = ({ web3SpaceId }: ActionButtonsProps) => {
  const tDho = useTranslations('DHO');
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  return (
    <>
      <Link
        className={isDisabled ? 'cursor-not-allowed' : ''}
        href={
          isAuthenticated && (isMember || isDelegate)
            ? `${cleanPath(pathname)}${PATH_SELECT_SETTINGS_ACTION}`
            : {}
        }
        title={tooltipMessage || tDho('actionButtons.spaceSettings')}
      >
        <Button colorVariant="accent" variant="outline" disabled={isDisabled}>
          <GearIcon className="sm:hidden" width={16} height={16} />
          <span className="hidden sm:flex">
            {tDho('actionButtons.spaceSettings')}
          </span>
        </Button>
      </Link>
      <Link
        className={isDisabled ? 'cursor-not-allowed' : ''}
        title={tooltipMessage || tDho('actionButtons.create')}
        href={
          isAuthenticated && (isMember || isDelegate)
            ? `${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`
            : {}
        }
      >
        <Button disabled={isDisabled} colorVariant="accent">
          <PlusIcon />
          {tDho('actionButtons.create')}
        </Button>
      </Link>
    </>
  );
};
