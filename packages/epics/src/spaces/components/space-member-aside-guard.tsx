'use client';

import { Space } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../hooks/use-can-mutate-in-space.web3.rpc';
import { SpaceAccessDenied } from './space-access-denied';
import { Skeleton } from '@hypha-platform/ui';

type SpaceMemberAsideGuardProps = {
  spaceSlug: string;
  spaceId?: number;
  space?: Space | null;
  children: React.ReactNode;
};

export function SpaceMemberAsideGuard({
  spaceSlug,
  spaceId,
  space,
  children,
}: SpaceMemberAsideGuardProps) {
  const { canMutate, isLoading, userState } = useCanMutateInSpace({
    spaceId,
    spaceSlug,
    space,
  });

  if (isLoading) {
    return (
      <div
        className="flex min-h-[12rem] flex-col gap-3 p-4"
        aria-busy="true"
        aria-live="polite"
      >
        <Skeleton loading height={24} width="60%" />
        <Skeleton loading height={120} width="100%" />
      </div>
    );
  }

  if (!canMutate) {
    return (
      <SpaceAccessDenied
        userState={userState}
        spaceId={spaceId}
        spaceSlug={spaceSlug}
      />
    );
  }

  return <>{children}</>;
}
