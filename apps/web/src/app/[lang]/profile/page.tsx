'use client';

import {
  PersonHead,
  AgreementsSection,
  ProposalsSection,
  MemberSpaces,
  SpaceGroupSlider,
  DocumentSection,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container } from '@hypha-platform/ui';
import { getDhoPathAgreements } from '../dho/[id]/@tab/agreements/constants';
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from '@hypha-platform/ui/server';
import { useMe } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';
import { useAuthentication } from '@hypha-platform/authentication';

export default function Profile() {
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  const getHref = (id: string) => {
    return getDhoPathAgreements(lang as Locale, id);
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
      <PersonHead
        isLoading={isLoading}
        avatar={person?.avatarUrl ?? ''}
        name={person?.name ?? ''}
        surname={person?.surname ?? ''}
        background={person?.leadImageUrl ?? ''}
        socials={{
          LinkedIn: person?.nickname ?? '',
          X: person?.nickname ?? '',
          Website: person?.nickname ?? '',
        }}
        about={person?.description ?? ''}
        onExportEmbeededWallet={isEmbeddedWallet ? exportWallet : undefined}
      />
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
          <AgreementsSection basePath="" useDocuments={useSpaceDocuments} />
        </TabsContent>
        <TabsContent value="proposals">
          <ProposalsSection basePath="" useDocuments={useSpaceDocuments} />
        </TabsContent>
        <TabsContent value="discussions">
          {/* TODO: #608 Define document base route to handle transition from profile */}
          <DocumentSection
            basePath=""
            useDocuments={useSpaceDocuments}
            documentState="proposal"
          />
        </TabsContent>
      </Tabs>
      <SpaceGroupSlider spaces={[]} type="Hypha" getHref={getHref} />
    </Container>
  );
}
