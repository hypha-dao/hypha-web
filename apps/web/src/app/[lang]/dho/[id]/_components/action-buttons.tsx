'use client';

import Link from 'next/link';

import { PlusIcon, Pencil2Icon } from '@radix-ui/react-icons';

import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { PATH_SEGMENT as PATH_SEGMENT_CREATE_ACTION } from '../@aside/[tab]/select-create-action/contants';
import { PATH_SEGMENT as PATH_SEGMENT_SETTINGS_ACTION } from '../@aside/[tab]/select-settings-action/contants';

const SEGMENTS = [PATH_SEGMENT_CREATE_ACTION, PATH_SEGMENT_SETTINGS_ACTION];

const cleanPath = (pathname: string) => {
  return SEGMENTS.reduce(
    (path, segment) =>
      path
        .split('/')
        .filter((s) => segment !== s)
        .join('/'),
    pathname,
  );
};

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
