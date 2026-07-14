'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { PendingRewardsSection } from '../../treasury/components/assets/pending-rewards-section';
import { UserAssetsSection } from '../../treasury/components/assets/user-assets-section';
import { UserTransactionsSection } from '../../treasury/components/requests/user-transactions-section';
import { ProfileBankingSection } from '../../banking/components/profile-banking-section';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { WalletActionsToolbar } from './wallet-actions-toolbar';

type MyWalletDashboardProps = {
  lang: string;
};

export function MyWalletDashboard({ lang }: MyWalletDashboardProps) {
  const tMyWallet = useTranslations('MyWallet');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const [activeTab, setActiveTab] = React.useState('wallet');

  const basePath = `/${lang}/my-wallet`;

  if (!isAuthenticated) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  if (isLoading || !person?.slug) {
    return (
      <p className="text-center text-muted-foreground">
        {tMyWallet('loading')}
      </p>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0 overflow-x-auto">
          <TabsList triggerVariant="switch" className="w-max max-w-full">
            <TabsTrigger value="wallet" variant="switch">
              {tMyWallet('tabs.wallet')}
            </TabsTrigger>
            <TabsTrigger value="banking" variant="switch">
              {tMyWallet('tabs.banking')}
            </TabsTrigger>
            <TabsTrigger value="transactions" variant="switch">
              {tMyWallet('tabs.transactions')}
            </TabsTrigger>
            <TabsTrigger value="rewards" variant="switch">
              {tMyWallet('tabs.rewards')}
            </TabsTrigger>
          </TabsList>
        </div>
        <WalletActionsToolbar basePath={basePath} />
      </div>

      <TabsContent value="wallet" className="mt-0">
        <UserAssetsSection
          personSlug={person.slug}
          basePath={basePath}
          isMyProfile
          showActionButtons={false}
        />
      </TabsContent>

      <TabsContent value="banking" className="mt-0">
        <ProfileBankingSection personSlug={person.slug} isMyProfile />
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
