'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { SectionFilter } from '@hypha-platform/ui/server';
import { AssetsSection } from './assets/assets-section';
import { VaultsSection } from './assets/vaults-section';
import { TransactionsSection } from './requests/transactions-section';

export type TreasuryTabbedViewProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId?: number;
};

type TreasurySubTab = 'balance' | 'transactions' | 'vaults';

export function TreasuryTabbedView({
  lang,
  spaceSlug,
  web3SpaceId,
}: TreasuryTabbedViewProps) {
  const tCommon = useTranslations('Common');
  const tTreasury = useTranslations('TreasuryTab');
  const [tab, setTab] = React.useState<TreasurySubTab>('balance');

  const basePath = `/${lang}/dho/${spaceSlug}/treasury`;

  return (
    <div className="flex flex-col gap-4 py-4" data-testid="treasury-tab-panels">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TreasurySubTab)}
        className="w-full min-w-0"
      >
        <div
          className="flex w-full min-w-0 flex-col gap-3"
          data-testid="treasury-section-toolbar"
        >
          <SectionFilter
            label={tCommon('Treasury')}
            className="min-w-0 flex-wrap justify-end gap-2 sm:flex-nowrap sm:justify-end"
          >
            <TabsList
              triggerVariant="switch"
              className="w-full shrink-0 justify-center sm:w-auto"
              data-testid="treasury-section-tabs"
            >
              <TabsTrigger variant="switch" value="balance">
                {tTreasury('balance')}
              </TabsTrigger>
              <TabsTrigger variant="switch" value="transactions">
                {tTreasury('transactions')}
              </TabsTrigger>
              <TabsTrigger variant="switch" value="vaults">
                {tTreasury('tabVaults')}
              </TabsTrigger>
            </TabsList>
          </SectionFilter>
        </div>

        <TabsContent value="balance" className="mt-1 outline-none">
          <AssetsSection basePath={basePath} web3SpaceId={web3SpaceId} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-1 outline-none">
          <TransactionsSection spaceSlug={spaceSlug} />
        </TabsContent>
        <TabsContent value="vaults" className="mt-1 outline-none">
          <VaultsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
