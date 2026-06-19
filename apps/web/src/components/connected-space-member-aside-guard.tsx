'use client';

import { SpaceMemberAsideGuard } from '@hypha-platform/epics';

type ConnectedSpaceMemberAsideGuardProps = {
  spaceSlug: string;
  spaceId?: number;
  children: React.ReactNode;
};

export function ConnectedSpaceMemberAsideGuard({
  spaceSlug,
  spaceId,
  children,
}: ConnectedSpaceMemberAsideGuardProps) {
  return (
    <SpaceMemberAsideGuard spaceSlug={spaceSlug} spaceId={spaceId}>
      {children}
    </SpaceMemberAsideGuard>
  );
}
