import { Locale } from '@hypha-platform/i18n';
import {
  PersonHead,
  MemberSpaces,
  SpaceGroupSlider,
  AgreementsSection,
  ProposalsSection,
  DiscussionsSection,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container } from '@hypha-platform/ui';
import { createSpaceService } from '@hypha-platform/core';
import { getDhoPathAgreements } from '../dho/[id]/agreements/constants';
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from '@hypha-platform/ui/server';

const AVATAR_URL = 'https://github.com/shadcn.png';
const BACKGROUND_URL = 'https://github.com/shadcn.png';
const ABOUT_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.';

type ProfilePageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Profile(props: ProfilePageProps) {
  const { lang } = await props.params;

  const getHref = (id: string) => {
    return getDhoPathAgreements(lang, id);
  };

  const personHeadProps = {
    avatar: AVATAR_URL,
    name: 'Name',
    surname: 'Surname',
    background: BACKGROUND_URL,
    socials: {
      LinkedIn: 'NameSurname',
      X: '@namesurname',
      Website: 'namesurname.org',
    },
    isLoading: false,
    about: ABOUT_TEXT,
  };

  const spaceService = createSpaceService();
  const spaces = await spaceService.getAll();

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
        <MemberSpaces spaces={spaces} profileView />
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
      <SpaceGroupSlider spaces={spaces} type="Hypha" getHref={getHref} />
    </Container>
  );
}
