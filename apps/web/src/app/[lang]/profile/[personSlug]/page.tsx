import {
  MFABanner,
  PersonHead,
  ProfileMemberSpaces,
  ProfilePageParams,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container, Separator } from '@hypha-platform/ui';
import React from 'react';
import {
  findPersonBySlug,
  getSpacesByWeb3Ids,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getMemberSpaces, Space } from '@hypha-platform/core/client';
import { ProfileTabs } from './_components/profile-tabs';
import { web3Client } from '@hypha-platform/core/server';
import { Hex, zeroAddress } from 'viem';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export async function generateMetadata(props: PageProps) {
  return {
    title: 'User Profile | Hypha',
    description: 'Show Hypha account info.',
  };
}

export default async function ProfilePage(props: PageProps) {
  const params = await props.params;

  const { lang, personSlug: personSlugRaw } = params;
  const personSlug = tryDecodeUriPart(personSlugRaw);

  const person = await findPersonBySlug({ slug: personSlug }, { db });
  const personAddress = (person?.address as Hex) || zeroAddress;
  let spaces: Space[] = [];
  try {
    const web3SpaceIds = await web3Client.readContract(
      getMemberSpaces({ memberAddress: personAddress }),
    );
    spaces = await getSpacesByWeb3Ids(web3SpaceIds.map(Number), {
      parentOnly: false,
    });
  } catch (error) {
    console.error('Failed to fetch member spaces:', error);
  }

  return (
    <Container className="w-full">
      <div className="mb-6 flex items-center w-full">
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
        <div className="flex flex-col gap-5">
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
            createdAt={person?.createdAt}
            exportEmbeddedWallet={true}
          />
          <Separator />
          <MFABanner />
          <ProfileMemberSpaces spaces={spaces} profileView={true} />
          <ProfileTabs person={person} lang={lang} />
        </div>
      ) : (
        <p>Person not found</p>
      )}
    </Container>
  );
}
