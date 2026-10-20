'use client';

import { MemberHomeBanner } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';
import { SpaceDashboard } from './space-dashboard';

/**
 * Same frame as the home ground, so the mycelium crop matches.
 * The layer sticks while the dashboard scrolls, then leaves with this page.
 */
const BANNER_HOLD_CLASS =
  'pointer-events-none sticky top-0 z-0 h-[calc(100svh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] -mb-[calc(100svh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] xl:h-[calc(100svh-var(--menu-top-height,4.5rem))] xl:-mb-[calc(100svh-var(--menu-top-height,4.5rem))]';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const tCommon = useTranslations('Common');

  return (
    <div className="relative isolate -mx-4 sm:-mx-5">
      <div aria-hidden className={BANNER_HOLD_CLASS}>
        <MemberHomeBanner />
      </div>
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
