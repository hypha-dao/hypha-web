'use client';

import * as React from 'react';
import Link from 'next/link';
import { MailIcon, MapPinIcon } from 'lucide-react';
import { RxPencil2 } from 'react-icons/rx';
import { Button } from '@hypha-platform/ui';
import {
  ButtonCopyUserId,
  CompactSpaceBanner,
  ExportEmbeddedWalletButton,
  ProfileComponentParams,
  SpaceAccentFromImages,
  SpaceAccentPortalBridge,
  StickyAccentChrome,
} from '@hypha-platform/epics';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  useMe,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';

export type ProfileChromeClientProps = {
  children: React.ReactNode;
  heroBannerImageHref: string;
  accentLogoHref: string;
  displayName: string;
  logoAlt: string;
  description: string;
  links: string[];
  email: string;
  location: string;
  slug: string;
  createdAt: Date | null;
  exportEmbeddedWallet: boolean;
};

export function ProfileChromeClient({
  children,
  heroBannerImageHref,
  accentLogoHref,
  displayName,
  logoAlt,
  description,
  links,
  email,
  location,
  slug,
  createdAt,
  exportEmbeddedWallet,
}: ProfileChromeClientProps) {
  const tProfile = useTranslations('Profile');
  const format = useFormatter();
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { isMe } = useMe();
  const { lang, personSlug: personSlugRaw } =
    useParams<ProfileComponentParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);

  const memberSinceText =
    createdAt != null
      ? tProfile('hyphaMemberSince', {
          date: format.dateTime(createdAt, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        })
      : null;

  const footerLeading = (
    <>
      {memberSinceText ? (
        <span className="text-white/90">{memberSinceText}</span>
      ) : null}
      {email && isMe(personSlug) ? (
        <span className="inline-flex items-center gap-2 text-white/88">
          <MailIcon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          {email}
        </span>
      ) : null}
      {location ? (
        <span className="inline-flex items-center gap-2 text-white/88">
          <MapPinIcon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          {location}
        </span>
      ) : null}
    </>
  );

  const actionsSlot = (
    <>
      {isMe(slug) && (
        <ExportEmbeddedWalletButton
          isLoading={false}
          isEmbeddedWallet={isEmbeddedWallet}
          label={tProfile('exportKeys')}
          onExportEmbeddedWallet={
            exportEmbeddedWallet && isEmbeddedWallet ? exportWallet : undefined
          }
        />
      )}
      <ButtonCopyUserId
        title={tProfile('copyUserId')}
        successMessage={tProfile('copied')}
        slug={slug}
      />
      <Link
        href={isMe(personSlug) ? `/${lang}/profile/${personSlug}/edit` : {}}
        scroll={false}
      >
        <Button colorVariant="accent" disabled={!isMe(personSlug)}>
          <RxPencil2 />
          {tProfile('editProfile')}
        </Button>
      </Link>
    </>
  );

  return (
    <SpaceAccentPortalBridge>
      <SpaceAccentFromImages
        bannerSrc={heroBannerImageHref}
        logoSrc={accentLogoHref}
      >
        <StickyAccentChrome
          banner={
            <CompactSpaceBanner
              title={displayName}
              description={description || undefined}
              logoUrl={accentLogoHref}
              logoAlt={logoAlt}
              defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
              links={links}
              leadImageUrl={heroBannerImageHref}
              defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
              memberCount={0}
              agreementCount={0}
              createdOnText=""
              membersLabel=""
              agreementsLabel=""
              footerLeading={footerLeading}
            />
          }
          actionsSlot={actionsSlot}
          title={displayName}
          logoUrl={accentLogoHref}
          logoAlt={logoAlt}
          defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
        />
        {children}
      </SpaceAccentFromImages>
    </SpaceAccentPortalBridge>
  );
}
