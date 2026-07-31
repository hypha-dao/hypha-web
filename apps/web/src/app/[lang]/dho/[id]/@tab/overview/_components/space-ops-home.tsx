'use client';

import { useTranslations } from 'next-intl';
import { TabScreenTitle } from '../../_components/tab-screen-title';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('OverviewOps');
  const tCommon = useTranslations('Common');

  return (
    <div className="flex flex-col gap-5 py-4 md:gap-6">
      <TabScreenTitle title={tCommon('home')} />

      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-2 font-medium text-foreground">
            {t('holdingsTitle')}
          </h2>
          <p className="craft-meta">{t('holdingsDescription')}</p>
        </header>
        <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
      </section>
    </div>
  );
}
