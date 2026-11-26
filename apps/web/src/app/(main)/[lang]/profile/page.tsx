'use client';

import { useState, useEffect } from 'react';
import {
  PersonHead,
  UserAssetsSection,
  UserTransactionsSection,
} from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import { useParams, useRouter } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui/server';
import { useTranslations } from 'next-intl';
import { ProfilePageFrame } from './_components/profile-page-frame';

export default function Profile() {
  const tProfile = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { lang } = useParams();
  const { person, isLoading } = useMe();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('treasury');

  useEffect(() => {
    if (!isLoading && person?.slug && person.slug.trim() !== '') {
      router.replace(`/${lang}/profile/${person?.slug}`);
    }
  }, [router, person, isLoading, lang]);

  const langStr = String(lang);

  if (!isLoading && person?.slug && person.slug.trim() !== '') {
    return (
      <ProfilePageFrame lang={langStr}>
        <div className="flex items-center justify-center">
          <p>{tProfile('redirectingToProfile')}</p>
        </div>
      </ProfilePageFrame>
    );
  }

  return (
    <ProfilePageFrame lang={langStr}>
      <div className="flex flex-col gap-6">
        <PersonHead
          isLoading={isLoading}
          avatar={''}
          name={''}
          surname={''}
          background={''}
          links={[]}
          about={''}
          location={''}
          email={''}
          slug={''}
          createdAt={new Date()}
          onExportEmbeddedWallet={isEmbeddedWallet ? exportWallet : undefined}
        />
        <Tabs value={activeTab} className="flex w-full flex-col gap-4">
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
          <TabsContent value="treasury" className="flex flex-col gap-4">
            <UserAssetsSection
              personSlug={person?.slug || ''}
              basePath={`/${lang}/profile`}
            />
            <UserTransactionsSection personSlug={person?.slug || ''} />
          </TabsContent>
        </Tabs>
      </div>
    </ProfilePageFrame>
  );
}
