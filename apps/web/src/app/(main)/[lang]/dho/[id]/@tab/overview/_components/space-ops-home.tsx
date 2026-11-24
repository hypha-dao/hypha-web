'use client';

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemberHomeBanner, useMemberExperience } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { MEMBER_CONTENT_GUTTER_BREAKOUT } from '../../../../../_components/member-page-shell';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';
import { MemberSpaceHome } from './member-space-home';
import { SpaceDashboard } from './space-dashboard';

/**
 * Full viewport from the top of the space column, so the ground continues
 * under the banner. Breaks out of the shared space gutters to the column edges.
 */
const GROUND_FRAME_CLASS = cn(
  'relative isolate h-[calc(100svh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] xl:h-[calc(100svh-var(--menu-top-height,4.5rem))]',
  MEMBER_CONTENT_GUTTER_BREAKOUT,
);

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const { isMember } = useMemberExperience();
  if (isMember) {
    return <MemberSpaceHome spaceSlug={spaceSlug} />;
  }
  return <SpaceOpsDashboard spaceSlug={spaceSlug} />;
}

function SpaceOpsDashboard({ spaceSlug }: { spaceSlug: string }) {
  const tCommon = useTranslations('Common');
  const [groundHost, setGroundHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = document.querySelector('[data-space-ground]');
    if (host instanceof HTMLElement) setGroundHost(host);
  }, []);

  return (
    <>
      {groundHost
        ? createPortal(
            <div aria-hidden className={GROUND_FRAME_CLASS}>
              <MemberHomeBanner className="member-home-banner--under-plate" />
            </div>,
            groundHost,
          )
        : null}
      <div className="relative z-[1] flex flex-col gap-8 py-4">
        <div className="flex flex-col gap-3">
          <TabScreenTitle title={tCommon('overview')} />
          <SpaceDashboard spaceSlug={spaceSlug} />
        </div>
        <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
      </div>
    </>
  );
}
