'use client';

import type { ReactNode } from 'react';
import {
  MemberSpaceHome,
  SpaceInviteArrival,
  isMemberMobilePersona,
} from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { SpaceOverviewEntry } from './space-overview-entry';

/**
 * Members get the space home. Everyone else keeps the existing overview,
 * including the energy-community redirect.
 */
export function SpaceOverviewForViewer({
  lang,
  spaceSlug,
  stay,
  inviteToken,
  children,
}: {
  lang: Locale;
  spaceSlug: string;
  stay: boolean;
  inviteToken?: string;
  children: ReactNode;
}) {
  const { person, isLoading } = useMe();
  const member = isMemberMobilePersona(person?.primaryOrientation);

  if (member) {
    return (
      <>
        {inviteToken ? (
          <div className="px-4 pt-4 sm:px-5">
            <SpaceInviteArrival lang={lang} token={inviteToken} />
          </div>
        ) : null}
        <MemberSpaceHome lang={lang} spaceSlug={spaceSlug} />
      </>
    );
  }

  if (isLoading && person === undefined) return null;

  return (
    <SpaceOverviewEntry spaceSlug={spaceSlug} stay={stay}>
      {children}
    </SpaceOverviewEntry>
  );
}
