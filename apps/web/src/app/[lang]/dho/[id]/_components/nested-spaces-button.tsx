'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';
import { PATH_SELECT_NAVIGATION_ACTION } from '@web/app/constants';
import { useSpaceDiscoverability } from '@hypha-platform/epics';
import { useUserSpaceState } from '@hypha-platform/epics';
import { checkDiscoverability } from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';

interface NestedSpacesButtonProps {
  web3SpaceId?: number;
  spaceSlug?: string;
}

export const NestedSpacesButton = ({
  web3SpaceId,
  spaceSlug,
}: NestedSpacesButtonProps) => {
  const pathname = usePathname();
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = web3SpaceId || space?.web3SpaceId || undefined;
  const effectiveSpaceSlug = spaceSlug || space?.slug;

  const { discoverability, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceId ? BigInt(effectiveSpaceId) : undefined,
    });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: effectiveSpaceId,
    spaceSlug: effectiveSpaceSlug,
    space,
  });

  const hasAccess = checkDiscoverability(discoverability, userState);
  const isLoading = isDiscoverabilityLoading || isUserStateLoading;
  const isDisabled = isLoading || !hasAccess;

  const tooltipMessage = isLoading
    ? 'Loading...'
    : !hasAccess
    ? 'You do not have access to view this space navigation.'
    : 'Space Navigation';

  return (
    <Link
      className={isDisabled ? 'cursor-not-allowed' : ''}
      href={
        hasAccess && !isLoading
          ? `${cleanPath(pathname)}${PATH_SELECT_NAVIGATION_ACTION}`
          : {}
      }
      title={tooltipMessage}
    >
      <Button
        variant="link"
        disabled={isDisabled}
        className="flex items-center gap-2 text-accent-11"
      >
        <Eye className="w-4 h-4" />
        <span>Space Navigation</span>
      </Button>
    </Link>
  );
};
