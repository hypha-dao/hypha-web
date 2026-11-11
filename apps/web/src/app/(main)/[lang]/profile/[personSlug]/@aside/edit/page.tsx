'use client';

import {
  ProposalOverlayShell,
  EditPersonSection,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { useMe, type Person } from '@hypha-platform/core/client';
import React from 'react';
import { useParams } from 'next/navigation';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import type { ProfileFormData } from '@web/hooks/profile-form-data';
import { LoadingBackdrop, Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

export default function EditProfilePage() {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { lang, personSlug: personSlugRaw } = useParams<ProfilePageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person, isLoading, revalidate } = useMe();
  const {
    editProfile,
    isEditing,
    error,
    progress,
    currentAction,
    isError,
    reset,
  } = useEditProfile();
  const router = useRouter();

  const onEdit = async (data: ProfileFormData) => {
    return editProfile(data);
  };

  const onUpdate = async (saved?: Person) => {
    if (saved) {
      await revalidate(saved);
    } else {
      await revalidate();
    }
    const nextSlug = saved?.slug?.trim() || person?.slug?.trim();
    if (nextSlug) {
      router.push(`/${lang}/profile/${encodeURIComponent(nextSlug)}`);
    } else {
      router.push(`/${lang}/profile`);
    }
  };

  return (
    <ProposalOverlayShell>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
        fullHeight={true}
        isLoading={isEditing}
        progress={progress}
        message={
          isError ? (
            <div className="flex flex-col">
              <div>{tSpaces('errorOhSnap')}</div>
              <Button onClick={reset}>{tSpaces('reset')}</Button>
            </div>
          ) : (
            <div>{currentAction}</div>
          )
        }
      >
        <EditPersonSection
          person={person ?? undefined}
          closeUrl={`/${lang}/profile/${personSlug}`}
          isLoading={isLoading || isEditing}
          onEdit={onEdit}
          onUpdate={onUpdate}
          error={error}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
