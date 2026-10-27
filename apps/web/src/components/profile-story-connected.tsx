'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  TOKEN_PRICE_REFERENCE_CURRENCIES,
  useMe,
} from '@hypha-platform/core/client';
import {
  ButtonCopyUserId,
  ExportEmbeddedWalletButton,
  ProfileStory,
  type ProfileStoryPatch,
  type ProfileStoryPerson,
} from '@hypha-platform/epics';
import { useEditProfile } from '@web/hooks/use-edit-profile';

export function ProfileStoryConnected({
  person,
  lang,
  afterHeader,
}: {
  person: ProfileStoryPerson;
  lang: string;
  afterHeader?: ReactNode;
}) {
  const router = useRouter();
  const tProfile = useTranslations('Profile');
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { person: me, revalidate } = useMe();
  const { editProfile, isEditing, error } = useEditProfile();
  const isSelf = me?.id === person.id;
  const source = isSelf && me ? me : person;

  const onSave = async (patch: ProfileStoryPatch) => {
    const currency = TOKEN_PRICE_REFERENCE_CURRENCIES.find(
      (code) =>
        code === (patch.preferredCurrency ?? source.preferredCurrency ?? ''),
    );
    const orientation =
      patch.primaryOrientation ??
      (source.primaryOrientation === 'member' ||
      source.primaryOrientation === 'builder' ||
      source.primaryOrientation === 'investor'
        ? source.primaryOrientation
        : undefined);
    const saved = await editProfile(
      {
        id: source.id,
        name: patch.name ?? source.name ?? '',
        surname: patch.surname ?? source.surname ?? '',
        nickname: patch.nickname ?? source.nickname ?? '',
        description: patch.description ?? source.description ?? '',
        email: patch.email ?? source.email ?? '',
        location: patch.location ?? source.location ?? '',
        links: patch.links ?? source.links ?? [],
        preferredCurrency: currency,
        primaryOrientation: orientation,
        networkOffer: patch.networkOffer ?? source.networkOffer ?? '',
        avatarUrl: patch.avatarFile ?? source.avatarUrl ?? '',
        leadImageUrl: patch.leadFile ?? source.leadImageUrl ?? '',
      },
      { quiet: true },
    );
    if (saved) await revalidate(saved);
    else await revalidate();
    const slug = saved?.slug?.trim();
    if (slug && slug !== source.slug) {
      router.push(`/${lang}/profile/${encodeURIComponent(slug)}`);
    }
  };

  const shown: ProfileStoryPerson = {
    id: source.id,
    name: source.name,
    surname: source.surname,
    nickname: source.nickname,
    description: source.description,
    location: source.location,
    email: source.email,
    links: source.links,
    preferredCurrency: source.preferredCurrency,
    primaryOrientation:
      source.primaryOrientation === 'member' ||
      source.primaryOrientation === 'builder' ||
      source.primaryOrientation === 'investor'
        ? source.primaryOrientation
        : null,
    networkOffer: source.networkOffer,
    slug: source.slug,
    avatarUrl: source.avatarUrl,
  };

  return (
    <ProfileStory
      person={shown}
      isSelf={isSelf}
      saving={isEditing}
      error={error}
      afterHeader={afterHeader}
      onSave={isSelf ? onSave : undefined}
      actions={
        <>
          {isSelf ? (
            <ExportEmbeddedWalletButton
              isLoading={false}
              isEmbeddedWallet={isEmbeddedWallet}
              label={tProfile('exportKeys')}
              onExportEmbeddedWallet={
                isEmbeddedWallet ? exportWallet : undefined
              }
            />
          ) : null}
          {shown.slug ? (
            <ButtonCopyUserId
              title={tProfile('copyUserId')}
              successMessage={tProfile('copied')}
              slug={shown.slug}
            />
          ) : null}
        </>
      }
    />
  );
}
