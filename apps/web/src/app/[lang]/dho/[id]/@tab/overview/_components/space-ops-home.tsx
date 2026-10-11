'use client';

import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';
import { SpaceDashboard } from './space-dashboard';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const tCommon = useTranslations('Common');

  return (
    <div className="flex flex-col gap-8 py-4">
      <TabScreenTitle title={tCommon('home')} />
      <SpaceDashboard spaceSlug={spaceSlug} />
      <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
    </div>
  );
}
