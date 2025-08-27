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

export const ActionButtons = () => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthentication();

  return (
    <>
      <Link
        className={!isAuthenticated ? 'cursor-not-allowed' : ''}
        href={
          isAuthenticated
            ? `${cleanPath(pathname)}${PATH_SELECT_SETTINGS_ACTION}`
            : {}
        }
        title={
          !isAuthenticated
            ? 'Please sign in to use this feature.'
            : 'Space Settings'
        }
      >
        <Button
          colorVariant="accent"
          variant={'outline'}
          disabled={!isAuthenticated}
        >
          <GearIcon className="sm:hidden" width={16} height={16} />
          <span className="hidden sm:flex">Space Settings</span>
        </Button>
      </Link>
      <Link
        className={!isAuthenticated ? 'cursor-not-allowed' : ''}
        title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
        href={
          isAuthenticated
            ? `${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`
            : {}
        }
      >
        <Button disabled={!isAuthenticated} colorVariant="accent">
          <PlusIcon />
          Create
        </Button>
      </Link>
    </>
  );
};
