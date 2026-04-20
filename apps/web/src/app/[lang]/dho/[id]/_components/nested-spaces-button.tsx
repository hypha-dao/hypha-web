'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';
import { PATH_SELECT_NAVIGATION_ACTION } from '@web/app/constants';
import { useSpaceDiscoverability } from '@hypha-platform/epics';
import { useUserSpaceState } from '@hypha-platform/epics';
import { checkAccess } from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface NestedSpacesButtonProps {
  web3SpaceId?: number;
  spaceSlug?: string;
  /** Compact hero overlay (smaller text, white links) */
  variant?: 'default' | 'heroCompact';
}

export const NestedSpacesButton = ({
  web3SpaceId,
  spaceSlug,
  variant = 'default',
}: NestedSpacesButtonProps) => {
  const tDho = useTranslations('DHO');
  const pathname = usePathname();
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = web3SpaceId || space?.web3SpaceId || undefined;
  const effectiveSpaceSlug = spaceSlug || space?.slug;

  const { access, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceId ? BigInt(effectiveSpaceId) : undefined,
    });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: effectiveSpaceId,
    spaceSlug: effectiveSpaceSlug,
    space,
  });

  const hasAccess = checkAccess(access, userState);
  const isLoading = isDiscoverabilityLoading || isUserStateLoading;
  const isDisabled = isLoading || !hasAccess;

  const tooltipMessage = isLoading
    ? tDho('nestedSpacesButton.loading')
    : !hasAccess
    ? tDho('nestedSpacesButton.noAccess')
    : tDho('nestedSpacesButton.label');

  const isHero = variant === 'heroCompact';

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
        className={
          isHero
            ? 'flex h-auto min-h-0 items-center gap-1.5 p-0 text-[11px] font-medium leading-tight text-white/90 underline-offset-2 hover:text-white hover:no-underline disabled:text-white/40 [&_svg]:size-3.5 [&_svg]:text-white/75'
            : 'flex items-center gap-2 text-accent-11'
        }
      >
        <Eye className={isHero ? 'size-3.5' : 'w-4 h-4'} />
        <span>{tDho('nestedSpacesButton.label')}</span>
      </Button>
    </Link>
  );
};
