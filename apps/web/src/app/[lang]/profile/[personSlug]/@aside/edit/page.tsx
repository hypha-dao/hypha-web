'use client';

import {
  SidePanel,
  EditPersonSection,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { useParams } from 'next/navigation';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import { LoadingBackdrop, Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import {
  schemaEditPersonWeb2,
  editPersonFiles,
} from '@hypha-platform/core/client';
import { z } from 'zod';
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

  const schemaEditPersonForm = schemaEditPersonWeb2.extend(
    editPersonFiles.shape,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEdit = async (data: any) => {
    try {
      await editProfile(data);
      router.push('/profile');
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <SidePanel>
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
          person={person}
          closeUrl={`/${lang}/profile/${personSlug}`}
          isLoading={isLoading || isEditing}
          onEdit={onEdit}
          onUpdate={revalidate}
          error={error}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
