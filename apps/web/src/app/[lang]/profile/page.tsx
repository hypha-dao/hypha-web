'use client';

import {
  PersonHead,
  AgreementsSection,
  ProposalsSection,
  DiscussionsSection,
  MemberSpaces,
  SpaceGroupSlider,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container } from '@hypha-platform/ui';
import { getDhoPathAgreements } from '../dho/[id]/agreements/constants';
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from '@hypha-platform/ui/server';
import { useMe } from '@web/hooks/use-me';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useEffect } from 'react';

export default function Profile() {
  const { lang } = useParams();
  const router = useRouter();
  const { person } = useMe();

  useEffect(() => {
    if (
      person &&
      typeof person === 'object' &&
      Object.keys(person).length === 0
    ) {
      router.push(`/${lang}/profile/signup`);
    }
  }, [person, lang, router]);

  if (
    !person ||
    typeof person !== 'object' ||
    Object.keys(person).length === 0
  ) {
    return null;
  }

  const getHref = (id: string) => {
    return getDhoPathAgreements(lang as Locale, id);
  };

  const personHeadProps = {
    avatar: person?.avatarUrl ?? '',
    name: person?.name ?? '',
    surname: person?.surname ?? '',
    background: person?.avatarUrl ?? '',
    socials: {
      LinkedIn: person?.nickname ?? '',
      X: person?.nickname ?? '',
      Website: person?.nickname ?? '',
    },
    isLoading: false,
    about: person?.description ?? '',
  };

  return (
    <Container>
      <div className="mb-6 flex items-center">
        <Link
          href={`/${lang}/my-spaces`}
          className="cursor-pointer flex items-center"
        >
          <ChevronLeftIcon width={16} height={16} />
          <Text className="text-sm">My Spaces</Text>
        </Link>
        <Text className="text-sm text-neutral-11 ml-1">/ Profile Page</Text>
      </div>
      <PersonHead {...personHeadProps} />
      <div className="mt-6">
        <MemberSpaces spaces={[]} profileView />
      </div>
      <Tabs defaultValue="agreements" className="w-full mt-16">
        <TabsList className="w-full mb-7">
          <TabsTrigger value="agreements" className="w-full" variant="ghost">
            Agreements
          </TabsTrigger>
          <TabsTrigger value="proposals" className="w-full" variant="ghost">
            Proposals
          </TabsTrigger>
          <TabsTrigger value="discussions" className="w-full" variant="ghost">
            Discussions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="agreements">
          <AgreementsSection basePath="" />
        </TabsContent>
        <TabsContent value="proposals">
          <ProposalsSection basePath="" />
        </TabsContent>
        <TabsContent value="discussions">
          <DiscussionsSection basePath="" />
        </TabsContent>
      </Tabs>
      <SpaceGroupSlider spaces={[]} type="Hypha" getHref={getHref} />
    </Container>
  );
}
