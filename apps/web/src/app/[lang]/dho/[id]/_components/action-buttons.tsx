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

interface ActionButtonsProps {
  web3SpaceId?: number;
}

export const ActionButtons = ({ web3SpaceId }: ActionButtonsProps) => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember && !isDelegate
    ? 'Please join this space to use this feature.'
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
        title={tooltipMessage || 'Space Settings'}
      >
        <Button colorVariant="accent" variant={'outline'} disabled={isDisabled}>
          <GearIcon className="sm:hidden" width={16} height={16} />
          <span className="hidden sm:flex">Space Settings</span>
        </Button>
      </Link>
      <Link
        className={isDisabled ? 'cursor-not-allowed' : ''}
        title={tooltipMessage || ''}
        href={
          isAuthenticated && (isMember || isDelegate)
            ? `${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`
            : {}
        }
      >
        <Button disabled={isDisabled} colorVariant="accent">
          <PlusIcon />
          Create
        </Button>
      </Link>
    </>
  );
};
