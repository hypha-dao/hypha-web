import { MemberSpaces, PersonHead } from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container, Separator } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { findAllSpaces, findPersonBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

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

  const person = await findPersonBySlug({ slug: personSlug}, { db });
  const spaces = await findAllSpaces({ db });

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
      {person ? (
        <>
          <PersonHead
            avatar={person?.avatarUrl ?? '/placeholder/default-profile.svg'}
            name={person?.name ?? ''}
            surname={person?.surname ?? ''}
            background={person?.leadImageUrl ?? ''}
            links={person?.links ?? []}
            about={person?.description ?? ''}
            location={person?.location ?? ''}
            email={person?.email ?? ''}
            slug={person?.slug ?? ''}
            exportEmbeddedWallet={true}
          />
          <Separator />
          <MemberSpaces
            spaces={spaces}
            personAddress={person?.address}
            personSlug={person?.slug}
            profileView={true}
          />
        </>
      ) : (
        <p>Person not found</p>
      )}
    </Container>
  );
}
