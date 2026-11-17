'use client';

import { SpaceMemberAsideGuard } from '@hypha-platform/epics';

type ConnectedSpaceMemberAsideGuardProps = {
  spaceSlug: string;
  spaceId?: number;
  closeUrl?: string;
  children: React.ReactNode;
};

export function ConnectedSpaceMemberAsideGuard({
  spaceSlug,
  spaceId,
  closeUrl,
  children,
}: ConnectedSpaceMemberAsideGuardProps) {
  return (
    <SpaceMemberAsideGuard
      spaceSlug={spaceSlug}
      spaceId={spaceId}
      closeUrl={closeUrl}
    >
      {children}
    </SpaceMemberAsideGuard>
  );
}
