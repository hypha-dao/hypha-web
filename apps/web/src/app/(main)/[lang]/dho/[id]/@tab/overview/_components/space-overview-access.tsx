'use client';

import type { ReactNode } from 'react';
import { SpaceTabAccessWrapper, useMemberExperience } from '@hypha-platform/epics';

import { TabLoadingSkeleton } from '../../_components/tab-loading-skeleton';

/**
 * Overview access gate. Members get the home-shaped pending mask so the
 * generic three-bar skeleton does not flash before MemberSpaceHome.
 */
export function SpaceOverviewAccess({
  spaceSlug,
  children,
}: {
  spaceSlug: string;
  children: ReactNode;
}) {
  const { isMember } = useMemberExperience();

  return (
    <SpaceTabAccessWrapper
      spaceSlug={spaceSlug}
      pendingFallback={
        isMember ? (
          <TabLoadingSkeleton layout="member-home" showTitle={false} />
        ) : undefined
      }
    >
      {children}
    </SpaceTabAccessWrapper>
  );
}
