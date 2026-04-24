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
  /** DB id — with `useMe` enables live merge after save even if URL slug lags (nickname change). */
  id?: number;
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
  id: personId,
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
  const { isMe, person: me } = useMe();
  const { lang, personSlug: personSlugRaw } =
    useParams<ProfileComponentParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);

  /**
   * Server `person` is static after navigation; SWR `me` updates after save without a full refresh.
   * On your own profile, prefer `me` so the hero reflects edits. Match by id (stable) and/or URL slug
   * so a nickname/slug change still updates before `router.push` completes.
   */
  const isSelfView = Boolean(
    me &&
      (personId != null
        ? Number(me.id) === Number(personId)
        : Boolean(personSlug) && me.slug === personSlug),
  );
  const isOwnProfile = isSelfView || (personSlug ? isMe(personSlug) : false);
  const self = React.useMemo(() => {
    if (!isSelfView || !me) {
      return {
        name,
        surname,
        slug,
        createdAt,
        about,
        background,
        links,
        location,
        email,
        avatar,
      };
    }
    return {
      name: me.name ?? name,
      surname: me.surname ?? surname,
      slug: me.slug ?? slug,
      createdAt: me.createdAt ?? createdAt,
      about: me.description,
      background: me.leadImageUrl,
      links: me.links ?? [],
      location: me.location,
      email: me.email,
      avatar: me.avatarUrl,
    };
  }, [
    isSelfView,
    me,
    name,
    surname,
    slug,
    createdAt,
    about,
    background,
    links,
    location,
    email,
    avatar,
  ]);

  const signupDate = self.createdAt
    ? format.dateTime(self.createdAt, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const displayName =
    `${self.name} ${self.surname}`.trim() || tProfile('profilePage');

  const rawLead = self.background?.trim();
  const heroBannerHref =
    rawLead && isSafeImageUrl(rawLead) ? rawLead : DEFAULT_SPACE_LEAD_IMAGE;

  const rawAvatar = self.avatar?.trim();
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
      {signupDate && self.email && isOwnProfile ? (
        <span className="text-white/45" aria-hidden>
          ·
        </span>
      ) : null}
      {self.email && isOwnProfile ? (
        <span className="inline-flex items-center gap-1.5">
          <MailIcon width={16} height={16} className="shrink-0 opacity-90" />
          <span>{self.email}</span>
        </span>
      ) : null}
      {(signupDate || (self.email && isOwnProfile)) && self.location ? (
        <span className="text-white/45" aria-hidden>
          ·
        </span>
      ) : null}
      {self.location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPinIcon width={16} height={16} className="shrink-0 opacity-90" />
          <span>{self.location}</span>
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
            description={self.about || undefined}
            logoUrl={accentLogoHref}
            logoAlt={displayName}
            defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
            links={self.links}
            leadImageUrl={heroBannerHref}
            defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
            descriptionLabel={tCommon('spaceBannerDescriptionAria', {
              title: displayName,
            })}
            showSpaceStats={false}
            footerLeading={footerMeta}
          />
        </Skeleton>

        <div className="flex flex-wrap justify-end gap-2">
          {isOwnProfile && (
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
            slug={self.slug}
            isLoading={isLoading}
          />
          <Skeleton loading={isLoading} width={120} height={35}>
            <Link
              href={
                isOwnProfile
                  ? `/${lang}/profile/${encodeURIComponent(
                      me?.slug ?? self.slug,
                    )}/edit`
                  : {}
              }
              scroll={false}
            >
              <Button colorVariant="accent" disabled={!isOwnProfile}>
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
