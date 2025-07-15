import { MemberSpaces, PersonHead } from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container, Separator } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { createSpaceService } from '@core/space/server';
import { createPeopleService } from '@core/people/server';

type PageProps = {
  params: Promise<{ lang: Locale; personSlug: string }>;
};

export async function generateMetadata(props: PageProps) {
  return {
    title: 'User Profile | Hypha',
    description: 'Show Hypha account info.',
  };
}

export default async function Profile(props: PageProps) {
  const params = await props.params;

  const { lang, personSlug } = params;

  const peopleService = createPeopleService();
  const person = await peopleService.findBySlug({ slug: personSlug });
  const spaces = await createSpaceService().getAll();

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
        avatar={person?.avatarUrl ?? ''}
        name={person?.name ?? ''}
        surname={person?.surname ?? ''}
        background={person?.leadImageUrl ?? ''}
        links={person?.links ?? []}
        about={person?.description ?? ''}
        location={person?.location ?? ''}
        email={person?.email ?? ''}
        exportEmbeddedWallet={true}
      />
      <Separator />
      <MemberSpaces
        spaces={spaces}
        person={person ?? undefined}
        profileView={true}
      />
    </Container>
  );
}
