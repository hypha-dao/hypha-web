'use client';

import { Space } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../hooks/use-can-mutate-in-space';
import { SpaceAccessDenied } from './space-access-denied';

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
    return <>{children}</>;
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
