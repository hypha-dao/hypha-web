'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import {
  PendingRewardsSection,
  UserAssetsSection,
  UserTransactionsSection,
} from '@hypha-platform/epics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';

type MyWalletTabsProps = {
  lang: Locale;
};

export function MyWalletTabs({ lang }: MyWalletTabsProps) {
  const [activeTab, setActiveTab] = React.useState('wallet');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const tTreasury = useTranslations('TreasuryTab');
  const tMyWallet = useTranslations('MyWallet');

  if (isLoading) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        {tMyWallet('loading')}
      </div>
    );
  }

  if (!isAuthenticated || !person?.slug) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        {tMyWallet('signInToViewWallet')}
      </div>
    );
  }

  const basePath = `/${lang}/profile/${person.slug}`;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full flex-col gap-3"
    >
      <div className="flex w-full justify-start">
        <TabsList triggerVariant="switch" className="w-fit">
          <TabsTrigger value="wallet" variant="switch">
            {tTreasury('wallet')}
          </TabsTrigger>
          <TabsTrigger value="transactions" variant="switch">
            {tTreasury('transactions')}
          </TabsTrigger>
          <TabsTrigger value="rewards" variant="switch">
            {tTreasury('rewardsSection.title')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="wallet" className="mt-0">
        <UserAssetsSection
          personSlug={person.slug}
          basePath={basePath}
          isMyProfile
        />
      </TabsContent>

      <TabsContent value="transactions" className="mt-0">
        <UserTransactionsSection personSlug={person.slug} />
      </TabsContent>

      <TabsContent value="rewards" className="mt-0">
        <PendingRewardsSection person={person} isMyProfile />
      </TabsContent>
    </Tabs>
  );
}
