import {
  EscrowDepositBanners,
  MFABanner,
  ProfileMemberSpaces,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { ProfileBackLink } from '@web/components/profile-back-link';
import { ProfileStoryConnected } from '@web/components/profile-story-connected';
import { Text } from '@radix-ui/themes';
import { Container, Separator } from '@hypha-platform/ui';
import React from 'react';
import {
  findPersonBySlug,
  getSpacesByWeb3Ids,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getMemberSpaces, Space } from '@hypha-platform/core/client';
import { web3Client } from '@hypha-platform/core/server';
import { Hex, zeroAddress } from 'viem';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

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
  const tProfile = await getTranslations('Profile');
  const personSlug = tryDecodeUriPart(personSlugRaw);

  // /profile/signup is the welcome flow, not a person. Looking that word up
  // rendered "Person not found" behind the form.
  if (personSlug === 'signup') {
    return null;
  }

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
        <ProfileBackLink lang={lang} />
        <Text className="text-sm text-neutral-11 ml-1">
          / {tProfile('profilePage')}
        </Text>
      </div>
      {person ? (
        <div className="flex flex-col gap-8">
          <ProfileStoryConnected
            lang={lang}
            person={{
              id: person.id,
              name: person.name,
              surname: person.surname,
              nickname: person.nickname,
              description: person.description,
              location: person.location,
              email: person.email,
              links: person.links,
              preferredCurrency: person.preferredCurrency,
              primaryOrientation: person.primaryOrientation,
              networkOffer: person.networkOffer,
              slug: person.slug,
              avatarUrl: person.avatarUrl,
              leadImageUrl: person.leadImageUrl,
            }}
            afterHeader={
              <ProfileMemberSpaces
                person={person}
                spaces={spaces}
                profileView={true}
              />
            }
          />
          <Separator />
          <MFABanner />
          <EscrowDepositBanners
            personSlug={person.slug ?? ''}
            personAddress={(person.address as `0x${string}`) ?? null}
          />
        </div>
      ) : (
        <p>{tProfile('personNotFound')}</p>
      )}
    </Container>
  );
}
