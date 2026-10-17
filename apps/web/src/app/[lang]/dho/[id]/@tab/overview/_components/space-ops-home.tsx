'use client';

import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';
import { SpaceDashboard } from './space-dashboard';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const tCommon = useTranslations('Common');

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <TabScreenTitle title={tCommon('overview')} />
        <SpaceDashboard spaceSlug={spaceSlug} />
      </div>
      <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
    </div>
  );
}
