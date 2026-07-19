'use client';

import { Skeleton } from '@hypha-platform/ui';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSpaceDiscoverability } from '../hooks/use-space-discoverability';
import { useUserSpaceState } from '../hooks/use-user-space-state.web3.rpc';
import { checkAccess } from '../utils/transparency-access';
import { SpaceAccessDenied } from './space-access-denied';

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

  const isPending =
    !effectiveSpaceId || isDiscoverabilityLoading || isUserStateLoading;

  if (isPending) {
    return (
      <div
        className="flex min-h-[12rem] flex-col gap-3 py-4"
        aria-busy="true"
        aria-live="polite"
      >
        <Skeleton loading height={28} width="40%" />
        <Skeleton loading height={120} width="100%" />
        <Skeleton loading height={120} width="100%" />
      </div>
    );
  }

  const hasAccess = checkAccess(access, userState);

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
