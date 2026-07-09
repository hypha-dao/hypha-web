'use client';

import { Person, useMe } from '@hypha-platform/core/client';
import {
  ProfileBankingSection,
  UserAssetsSection,
  UserTransactionsSection,
  PendingRewardsSection,
} from '@hypha-platform/epics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import React from 'react';
import { useTranslations } from 'next-intl';

export const ProfileTabs = ({
  person,
  lang,
}: {
  person?: Person;
  lang: string;
}) => {
  const tCommon = useTranslations('Common');
  const [activeTab, setActiveTab] = React.useState('treasury');
  const [treasuryView, setTreasuryView] = React.useState('wallet');
  const { person: authenticatedPerson } = useMe();
  const isMyProfile =
    person?.address?.toLowerCase() ===
    authenticatedPerson?.address?.toLowerCase();

  const walletContent = (
    <div className="flex flex-col gap-6">
      <PendingRewardsSection
        person={person as Person}
        isMyProfile={isMyProfile}
      />
      <UserAssetsSection
        isMyProfile={isMyProfile}
        personSlug={person?.slug || ''}
        basePath={`/${lang}/profile/${person?.slug}`}
      />
      <UserTransactionsSection personSlug={person?.slug || ''} />
    </div>
  );

  return (
    <Tabs value={activeTab} className="w-full flex flex-col gap-4">
      <TabsList className="w-full">
        <TabsTrigger
          value="treasury"
          className="w-full"
          variant="ghost"
          onClick={() => setActiveTab('treasury')}
        >
          {tCommon('Treasury')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="treasury" className="flex flex-col gap-6">
        {isMyProfile ? (
          <Tabs
            value={treasuryView}
            onValueChange={setTreasuryView}
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
              </TabsList>
            </div>

            <TabsContent value="wallet" className="mt-0">
              {walletContent}
            </TabsContent>

            <TabsContent value="banking" className="mt-0">
              <ProfileBankingSection
                personSlug={person?.slug || ''}
                isMyProfile={isMyProfile}
              />
            </TabsContent>
          </Tabs>
        ) : (
          walletContent
        )}
      </TabsContent>
    </Tabs>
  );
};
