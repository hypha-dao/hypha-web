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
import { getDhoPathGovernance } from '../dho/[id]/@tab/governance/constants';
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
    return getDhoPathGovernance(lang as Locale, id);
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
        links={person?.links ?? []}
        about={person?.description ?? ''}
        location={person?.location ?? ''}
        email={person?.email ?? ''}
        onExportEmbeededWallet={isEmbeddedWallet ? exportWallet : undefined}
      />
    </Container>
  );
}
