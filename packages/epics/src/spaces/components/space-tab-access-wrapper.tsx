'use client';

import { useSpaceDiscoverability } from '../hooks/use-space-discoverability';
import { useUserSpaceState } from '../hooks/use-user-space-state';
import { checkAccess } from '../utils/transparency-access';
import { SpaceAccessDenied } from './space-access-denied';
import { useSpaceBySlug } from '@hypha-platform/core/client';

type SpaceTabAccessWrapperProps = {
  spaceId?: number;
  spaceSlug?: string;
  children: React.ReactNode;
};

export function SpaceTabAccessWrapper({
  spaceId,
  spaceSlug,
  children,
}: SpaceTabAccessWrapperProps) {
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = spaceId || space?.web3SpaceId || undefined;

  const { access, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceId ? BigInt(effectiveSpaceId) : undefined,
    });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: effectiveSpaceId,
    spaceSlug,
    space,
  });

  const hasAccess = checkAccess(access, userState);
  const isLoading = isDiscoverabilityLoading || isUserStateLoading;

  if (isLoading) {
    return <>{children}</>;
  }

  if (!hasAccess) {
    return (
      <SpaceAccessDenied
        userState={userState}
        spaceId={effectiveSpaceId}
        spaceSlug={spaceSlug}
      />
    );
  }

  return <>{children}</>;
}
