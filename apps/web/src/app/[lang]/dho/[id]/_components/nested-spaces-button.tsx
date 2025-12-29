'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';
import { PATH_SELECT_NAVIGATION_ACTION } from '@web/app/constants';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from '@hypha-platform/epics';
import { useIsDelegate } from '@hypha-platform/core/client';

interface NestedSpacesButtonProps {
  web3SpaceId?: number;
}

export const NestedSpacesButton = ({
  web3SpaceId,
}: NestedSpacesButtonProps) => {
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
    <Link
      className={isDisabled ? 'cursor-not-allowed' : ''}
      href={
        isAuthenticated && (isMember || isDelegate)
          ? `${cleanPath(pathname)}${PATH_SELECT_NAVIGATION_ACTION}`
          : {}
      }
      title={tooltipMessage || 'Space Navigation'}
    >
      <Button
        colorVariant="accent"
        variant="link"
        disabled={isDisabled}
        className="flex items-center gap-2"
      >
        <Eye className="w-4 h-4" />
        <span>Space Navigation</span>
      </Button>
    </Link>
  );
};
