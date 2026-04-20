import {
  EscrowDepositBanners,
  MFABanner,
  ProfileMemberSpaces,
  ProfilePageParams,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Container, Separator } from '@hypha-platform/ui';
import {
  findPersonBySlug,
  getSpacesByWeb3Ids,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  getMemberSpaces,
  Space,
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import { ProfileTabs } from './_components/profile-tabs';
import { web3Client } from '@hypha-platform/core/server';
import { Hex, zeroAddress } from 'viem';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';
import { ProfileChromeClient } from './_components/profile-chrome-client';
import './profile-accent.css';

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
  const tNav = await getTranslations('Navigation');
  const tProfile = await getTranslations('Profile');
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

  const rawLead = person?.leadImageUrl?.trim();
  const heroBannerImageHref =
    person &&
    rawLead &&
    ((rawLead.startsWith('/') && !rawLead.startsWith('//')) ||
      /^https?:\/\//i.test(rawLead))
      ? rawLead
      : DEFAULT_SPACE_LEAD_IMAGE;

  const rawAvatar = person?.avatarUrl?.trim();
  const accentLogoHref =
    person &&
    rawAvatar &&
    ((rawAvatar.startsWith('/') && !rawAvatar.startsWith('//')) ||
      /^https?:\/\//i.test(rawAvatar))
      ? rawAvatar
      : DEFAULT_SPACE_AVATAR_IMAGE;

  const displayName = person
    ? `${person.name ?? ''} ${person.surname ?? ''}`.trim()
    : '';
  const logoAlt = displayName || person?.slug || 'Profile';

  return (
    <Container className="w-full">
      <div className="mb-6 flex items-center w-full">
        <Link
          href={`/${lang}/my-spaces`}
          className="cursor-pointer flex items-center"
        >
          <ChevronLeftIcon width={16} height={16} />
          <Text className="text-sm">{tNav('mySpaces')}</Text>
        </Link>
        <Text className="text-sm text-neutral-11 ml-1">
          / {tProfile('profilePage')}
        </Text>
      </div>
      {person ? (
        <>
          {heroBannerImageHref ? (
            <link
              rel="preload"
              as="image"
              href={heroBannerImageHref}
              fetchPriority="high"
            />
          ) : null}
          <ProfileChromeClient
            heroBannerImageHref={heroBannerImageHref}
            accentLogoHref={accentLogoHref}
            displayName={displayName || person.slug || ''}
            logoAlt={logoAlt}
            description={person.description ?? ''}
            links={(person.links ?? []).filter(
              (l): l is string => typeof l === 'string',
            )}
            email={person.email ?? ''}
            location={person.location ?? ''}
            slug={person.slug ?? ''}
            createdAt={person.createdAt ?? null}
            exportEmbeddedWallet={true}
          >
            <div className="flex flex-col gap-5">
              <Separator />
              <MFABanner />
              <EscrowDepositBanners
                personSlug={person.slug ?? ''}
                personAddress={(person.address as `0x${string}`) ?? null}
              />
              <ProfileMemberSpaces
                person={person}
                spaces={spaces}
                profileView={true}
              />
              <ProfileTabs person={person} lang={lang} />
            </div>
          </ProfileChromeClient>
        </>
      ) : (
        <p>{tProfile('personNotFound')}</p>
      )}
    </Container>
  );
}
