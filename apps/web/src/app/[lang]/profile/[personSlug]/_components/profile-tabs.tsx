'use client';

import { Person, useMe } from '@hypha-platform/core/client';
import {
  UserAssetsSection,
  UserTransactionsSection,
} from '@hypha-platform/epics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import React from 'react';

export const ProfileTabs = ({
  person,
  lang,
}: {
  person?: Person;
  lang: string;
}) => {
  const [activeTab, setActiveTab] = React.useState('treasury');
  const { person: authenticatedPerson } = useMe();
  const isMyProfile =
    person?.address?.toLowerCase() ===
    authenticatedPerson?.address?.toLowerCase();

  return (
    <Tabs value={activeTab} className="w-full flex flex-col gap-4">
      <TabsList className="w-full">
        <TabsTrigger
          value="treasury"
          className="w-full"
          variant="ghost"
          onClick={() => setActiveTab('treasury')}
        >
          Treasury
        </TabsTrigger>
      </TabsList>
      <TabsContent value="treasury" className="flex flex-col gap-4">
        <UserAssetsSection
          isMyProfile={isMyProfile}
          personSlug={person?.slug || ''}
          basePath={`/${lang}/profile/${person?.slug}`}
        />
        {/* TODO: Temporarily hidden for #1331 */}
        {/* <UserTransactionsSection personSlug={person?.slug || ''} /> */}
      </TabsContent>
    </Tabs>
  );
};
