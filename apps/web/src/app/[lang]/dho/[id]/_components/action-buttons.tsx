'use client';

import Link from 'next/link';

import { PlusIcon } from '@radix-ui/react-icons';

import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';

export const ActionButtons = () => {
  const pathname = usePathname();

  return (
    <>
      <Button asChild colorVariant="accent" variant={'outline'}>
        <Link href={`${cleanPath(pathname)}/select-settings-action`}>
          Space Settings
        </Link>
      </Button>
      <Button asChild colorVariant="accent">
        <Link href={`${cleanPath(pathname)}/select-create-action`}>
          <PlusIcon />
          Create
        </Link>
      </Button>
    </>
  );
};
