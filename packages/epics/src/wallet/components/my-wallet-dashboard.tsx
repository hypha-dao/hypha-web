'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { PendingRewardsSection } from '../../treasury/components/assets/pending-rewards-section';
import { UserAssetsSection } from '../../treasury/components/assets/user-assets-section';
import { UserTransactionsSection } from '../../treasury/components/requests/user-transactions-section';
import { ProfileBankingSection } from '../../banking/components/profile-banking-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { WalletActionsToolbar } from './wallet-actions-toolbar';

type MyWalletDashboardProps = {
  lang: string;
};

export function MyWalletDashboard({ lang }: MyWalletDashboardProps) {
  const tCommon = useTranslations('Common');
  const tTreasury = useTranslations('TreasuryTab');
  const tProfile = useTranslations('Profile');
  const tMyWallet = useTranslations('MyWallet');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const [activeTab, setActiveTab] = React.useState('wallet');

  const basePath = `/${lang}/my-wallet`;

  if (!isAuthenticated) {
    return (
      <p className="text-center text-muted-foreground">
        {tMyWallet('signInToViewWallet')}
      </p>
    );
  }

  if (isLoading || !person?.slug) {
    return (
      <p className="text-center text-muted-foreground">
        {tMyWallet('loading')}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <WalletActionsToolbar basePath={basePath} />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex w-full flex-col gap-4"
      >
        <div className="flex w-full justify-start">
          <TabsList triggerVariant="switch" className="w-fit">
            <TabsTrigger value="wallet" variant="switch">
              {tCommon('Wallet')}
            </TabsTrigger>
            <TabsTrigger value="banking" variant="switch">
              {tCommon('Banking')}
            </TabsTrigger>
            <TabsTrigger value="transactions" variant="switch">
              {tTreasury('transactions')}
            </TabsTrigger>
            <TabsTrigger value="rewards" variant="switch">
              {tProfile('rewards')}
            </TabsTrigger>
          </TabsList>
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
    </div>
  );
}
