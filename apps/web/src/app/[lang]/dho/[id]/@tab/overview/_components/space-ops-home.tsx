'use client';

import { useRenderTrace2575 } from '@hypha-platform/core/client'; // TEMP(#2575)
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemberHomeBanner } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';
import { SpaceDashboard } from './space-dashboard';

/**
 * Full viewport from the top of the space column, so the ground continues
 * under the banner. It breaks out of the column padding to the column edges.
 */
const GROUND_FRAME_CLASS =
  'relative isolate -mx-4 h-[calc(100svh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] w-[calc(100%+2rem)] sm:-mx-5 sm:w-[calc(100%+3rem)] xl:h-[calc(100svh-var(--menu-top-height,4.5rem))]';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  useRenderTrace2575('SpaceOpsHome');
  const tCommon = useTranslations('Common');
  const [groundHost, setGroundHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = document.querySelector('[data-space-ground]');
    if (host instanceof HTMLElement) setGroundHost(host);
  }, []);

  return (
    <div className="relative isolate -mx-4 sm:-mx-5">
      {groundHost
        ? createPortal(
            <div aria-hidden className={GROUND_FRAME_CLASS}>
              <MemberHomeBanner className="member-home-banner--under-plate" />
            </div>,
            groundHost,
          )
        : null}
      <div className="relative z-[1] flex flex-col gap-8 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3">
          <TabScreenTitle title={tCommon('overview')} />
          <SpaceDashboard spaceSlug={spaceSlug} />
        </div>
        <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
      </div>
    </div>
  );
}
