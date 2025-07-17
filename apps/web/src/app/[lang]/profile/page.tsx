'use client';

import { useState } from 'react';
import { PersonHead, UserAssetsSection } from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui/server';

export default function Profile() {
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  const [activeTab, setActiveTab] = useState('treasury');

  return (
    <Container className="flex flex-col space-y-6 py-4">
      <div className="flex items-center">
        <Link
          href={`/${lang}/my-spaces`}
          className="cursor-pointer flex items-center"
        >
          <ChevronLeftIcon width={16} height={16} />
          <Text className="text-sm">My Spaces</Text>
        </Link>
        <Text className="text-sm text-neutral-11 ml-1">/ Profile Page</Text>
      </div>
      <PersonHead
        isLoading={isLoading}
        avatar={person?.avatarUrl ?? ''}
        name={person?.name ?? ''}
        surname={person?.surname ?? ''}
        background={person?.leadImageUrl ?? ''}
        links={person?.links ?? []}
        about={person?.description ?? ''}
        location={person?.location ?? ''}
        email={person?.email ?? ''}
        onExportEmbeededWallet={isEmbeddedWallet ? exportWallet : undefined}
      />
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
        <TabsContent value="treasury">
          <UserAssetsSection personSlug={person?.slug || ''} />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
