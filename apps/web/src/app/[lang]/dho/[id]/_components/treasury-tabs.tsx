'use client';

import { useState } from 'react';
import {
  AssetsSection,
  TransactionsSection,
  VaultsSection,
} from '@hypha-platform/epics';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type TreasuryTabsProps = {
  basePath: string;
  spaceSlug: string;
  web3SpaceId: number;
};

export function TreasuryTabs({
  basePath,
  spaceSlug,
  web3SpaceId,
}: TreasuryTabsProps) {
  const tTreasury = useTranslations('TreasuryTab');
  const [activeTab, setActiveTab] = useState('balance');

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full flex-col gap-4"
    >
      <div className="flex w-full justify-center">
        <TabsList triggerVariant="switch" className="w-fit">
          <TabsTrigger value="balance" variant="switch">
            {tTreasury('balance')}
          </TabsTrigger>
          <TabsTrigger value="transactions" variant="switch">
            {tTreasury('transactions')}
          </TabsTrigger>
          <TabsTrigger value="vaults" variant="switch">
            {tTreasury('vaults')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="balance" className="mt-0">
        <AssetsSection basePath={basePath} web3SpaceId={web3SpaceId} />
      </TabsContent>

      <TabsContent value="transactions" className="mt-0">
        <TransactionsSection spaceSlug={spaceSlug} />
      </TabsContent>

      <TabsContent value="vaults" className="mt-0">
        <VaultsSection />
      </TabsContent>
    </Tabs>
  );
}
