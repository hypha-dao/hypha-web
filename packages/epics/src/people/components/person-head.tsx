'use client';

import { Button, Skeleton } from '@hypha-platform/ui';
import { RxPencil2 } from 'react-icons/rx';
import { MailIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';
import { ButtonCopyUserId } from './button-copy-user-id';
import { ExportEmbeddedWalletButton } from './export-embedded-wallet-button';
import { CompactSpaceBanner } from '../../spaces/components/compact-space-banner';
import { SpaceAccentFromImages } from '../../spaces/components/space-accent-from-images';
import { isSafeImageUrl } from '../../spaces/utils/safe-image-url';
import type { ProfileComponentParams } from './types';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  useMe,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';

export type MemberType = {
  avatar: string;
  name: string;
  surname: string;
  slug: string;
  createdAt?: Date;
};

interface PersonHeadProps {
  isLoading?: boolean;
  about: string;
  background: string;
  links: string[];
  location: string;
  email: string;
  onExportEmbeddedWallet?: () => void;
  exportEmbeddedWallet?: boolean;
}

export const PersonHead = ({
  isLoading = false,
  avatar = DEFAULT_SPACE_AVATAR_IMAGE,
  name,
  surname,
  slug,
  createdAt,
  about,
  background,
  links,
  location,
  email,
  onExportEmbeddedWallet,
  exportEmbeddedWallet,
}: PersonHeadProps & MemberType) => {
  const tProfile = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { isMe } = useMe();
  const { lang, personSlug: personSlugRaw } =
    useParams<ProfileComponentParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);

  const signupDate = createdAt
    ? format.dateTime(createdAt, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const displayName = `${name} ${surname}`.trim() || tProfile('profilePage');

  const rawLead = background?.trim();
  const heroBannerHref =
    rawLead && isSafeImageUrl(rawLead) ? rawLead : DEFAULT_SPACE_LEAD_IMAGE;

  const rawAvatar = avatar?.trim();
  const accentLogoHref =
    rawAvatar && isSafeImageUrl(rawAvatar)
      ? rawAvatar
      : DEFAULT_SPACE_AVATAR_IMAGE;

  const footerMeta = (
    <>
      {signupDate ? (
        <span className="text-white/88">
          {tProfile('hyphaMemberSince', { date: signupDate })}
        </span>
      ) : null}
      {signupDate && email && isMe(personSlug) ? (
        <span className="text-white/45" aria-hidden>
          ·
        </span>
      ) : null}
      {email && isMe(personSlug) ? (
        <span className="inline-flex items-center gap-1.5">
          <MailIcon width={16} height={16} className="shrink-0 opacity-90" />
          <span>{email}</span>
        </span>
      ) : null}
      {(signupDate || (email && isMe(personSlug))) && location ? (
        <span className="text-white/45" aria-hidden>
          ·
        </span>
      ) : null}
      {location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPinIcon width={16} height={16} className="shrink-0 opacity-90" />
          <span>{location}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <SpaceAccentFromImages bannerSrc={heroBannerHref} logoSrc={accentLogoHref}>
      <div className="flex flex-col gap-4">
        <Skeleton
          loading={isLoading}
          height={320}
          className="w-full rounded-xl"
        >
          <CompactSpaceBanner
            title={displayName}
            description={about || undefined}
            logoUrl={accentLogoHref}
            logoAlt={displayName}
            defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
            links={links}
            leadImageUrl={heroBannerHref}
            defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
            memberCount={0}
            agreementCount={0}
            createdOnText=""
            membersLabel=""
            agreementsLabel=""
            descriptionLabel={tCommon('spaceBannerDescriptionAria', {
              title: displayName,
            })}
            showSpaceStats={false}
            footerLeading={footerMeta}
          />
        </Skeleton>

        <div className="flex flex-wrap justify-end gap-2">
          {isMe(slug) && (
            <ExportEmbeddedWalletButton
              isLoading={isLoading}
              isEmbeddedWallet={isEmbeddedWallet || !!onExportEmbeddedWallet}
              label={tProfile('exportKeys')}
              onExportEmbeddedWallet={
                exportEmbeddedWallet && isEmbeddedWallet
                  ? exportWallet
                  : onExportEmbeddedWallet
              }
            />
          )}
          <ButtonCopyUserId
            title={tProfile('copyUserId')}
            successMessage={tProfile('copied')}
            slug={slug}
            isLoading={isLoading}
          />
          <Skeleton loading={isLoading} width={120} height={35}>
            <Link
              href={
                isMe(personSlug) ? `/${lang}/profile/${personSlug}/edit` : {}
              }
              scroll={false}
            >
              <Button colorVariant="accent" disabled={!isMe(personSlug)}>
                <RxPencil2 />
                {tProfile('editProfile')}
              </Button>
            </Link>
          </Skeleton>
        </div>
      </div>
    </SpaceAccentFromImages>
  );
};
