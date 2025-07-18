'use client';

import { Person } from '@hypha-platform/core/client';
import {
  UserAssetsSection,
  UserTransactionsSection,
} from '@hypha-platform/epics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import React from 'react';

export const ProfileTabs = ({ person }: { person?: Person }) => {
  const [activeTab, setActiveTab] = React.useState('treasury');

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
        <UserAssetsSection personSlug={person?.slug || ''} />
        <UserTransactionsSection personSlug={person?.slug || ''} />
      </TabsContent>
    </Tabs>
  );
};
