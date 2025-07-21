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

export const ActionButtons = () => {
  const pathname = usePathname();

  return (
    <>
      <Button
        asChild
        colorVariant="accent"
        variant={'outline'}
        title="Space Settings"
      >
        <Link href={`${cleanPath(pathname)}${PATH_SELECT_SETTINGS_ACTION}`}>
          <GearIcon className="sm:hidden" width={16} height={16} />
          <span className="hidden sm:flex">Space Settings</span>
        </Link>
      </Button>
      <Button asChild colorVariant="accent">
        <Link href={`${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`}>
          <PlusIcon />
          Create
        </Link>
      </Button>
    </>
  );
};
