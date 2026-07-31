'use client';

import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const tCommon = useTranslations('Common');

  return (
    <div className="flex flex-col gap-5 py-4 md:gap-6">
      <TabScreenTitle title={tCommon('home')} />
      <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
    </div>
  );
}
