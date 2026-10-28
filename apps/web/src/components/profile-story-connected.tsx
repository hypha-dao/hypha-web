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

function pickText(
  next: string | null | undefined,
  fallback: string | null | undefined,
): string | null | undefined {
  if (typeof next === 'string') return next;
  return fallback;
}

function pickLinks(
  next: string[] | null | undefined,
  fallback: string[] | null | undefined,
): string[] | null | undefined {
  if (Array.isArray(next)) return next;
  return fallback;
}

function mergeStoryPerson(
  pagePerson: ProfileStoryPerson,
  me: ProfileStoryPerson | null | undefined,
  isSelf: boolean,
): ProfileStoryPerson {
  if (!isSelf || !me) return pagePerson;
  // Prefer the live `/me` row, but keep page fields when `/me` omitted them.
  // Otherwise an incomplete cache wipe wipes the banner, currency, and links.
  return {
    id: me.id,
    name: pickText(me.name, pagePerson.name),
    surname: pickText(me.surname, pagePerson.surname),
    nickname: pickText(me.nickname, pagePerson.nickname),
    description: pickText(me.description, pagePerson.description),
    location: pickText(me.location, pagePerson.location),
    email: pickText(me.email, pagePerson.email),
    links: pickLinks(me.links, pagePerson.links),
    preferredCurrency: pickText(
      me.preferredCurrency,
      pagePerson.preferredCurrency,
    ),
    primaryOrientation:
      me.primaryOrientation === 'member' ||
      me.primaryOrientation === 'builder' ||
      me.primaryOrientation === 'investor'
        ? me.primaryOrientation
        : pagePerson.primaryOrientation === 'member' ||
          pagePerson.primaryOrientation === 'builder' ||
          pagePerson.primaryOrientation === 'investor'
        ? pagePerson.primaryOrientation
        : null,
    networkOffer: pickText(me.networkOffer, pagePerson.networkOffer),
    slug: pickText(me.slug, pagePerson.slug),
    avatarUrl: pickText(me.avatarUrl, pagePerson.avatarUrl),
    leadImageUrl: pickText(me.leadImageUrl, pagePerson.leadImageUrl),
  };
}

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
  const source = mergeStoryPerson(person, me, isSelf);

  const onSave = async (patch: ProfileStoryPatch) => {
    const preferredCurrencyCode =
      patch.preferredCurrency ?? source.preferredCurrency ?? '';
    const currency = TOKEN_PRICE_REFERENCE_CURRENCIES.find(
      (code) => code === preferredCurrencyCode,
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
        // Keep the current URLs unless a new file was chosen. An empty string
        // here used to clear the portrait and banner on every other edit.
        avatarUrl: patch.avatarFile ?? source.avatarUrl,
        leadImageUrl: patch.leadFile ?? source.leadImageUrl,
      },
      { quiet: true },
    );
    if (saved) {
      await revalidate({
        ...source,
        ...saved,
        links: saved.links ?? source.links,
        preferredCurrency: saved.preferredCurrency ?? source.preferredCurrency,
        avatarUrl: saved.avatarUrl ?? source.avatarUrl,
        leadImageUrl: saved.leadImageUrl ?? source.leadImageUrl,
        networkOffer: saved.networkOffer ?? source.networkOffer,
        primaryOrientation:
          saved.primaryOrientation === 'member' ||
          saved.primaryOrientation === 'builder' ||
          saved.primaryOrientation === 'investor'
            ? saved.primaryOrientation
            : source.primaryOrientation,
      });
    } else {
      await revalidate();
    }
    const slug = saved?.slug?.trim();
    if (slug && slug !== source.slug) {
      router.push(`/${lang}/profile/${encodeURIComponent(slug)}`);
    }
  };

  return (
    <ProfileStory
      person={source}
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
          {source.slug ? (
            <ButtonCopyUserId
              title={tProfile('copyUserId')}
              successMessage={tProfile('copied')}
              slug={source.slug}
            />
          ) : null}
        </>
      }
    />
  );
}
