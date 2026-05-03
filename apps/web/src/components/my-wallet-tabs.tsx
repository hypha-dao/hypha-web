'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
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

  if (isLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!isAuthenticated || !person?.slug) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        Sign in to view your wallet.
      </div>
    );
  }

  const basePath = `/${lang}/profile/${person.slug}`;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full flex-col gap-4"
    >
      <div className="flex w-full justify-start">
        <TabsList triggerVariant="switch" className="w-fit">
          <TabsTrigger value="wallet" variant="switch">
            Wallet
          </TabsTrigger>
          <TabsTrigger value="transactions" variant="switch">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="rewards" variant="switch">
            Rewards
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
