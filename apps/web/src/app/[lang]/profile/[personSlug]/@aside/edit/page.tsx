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

export default function EditProfilePage() {
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
  type EditPersonFormData = z.infer<typeof schemaEditPersonForm>;

  const onEdit = async (data: EditPersonFormData) => {
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
        isLoading={isEditing}
        progress={progress}
        message={
          isError ? (
            <div className="flex flex-col">
              <div>Ouh Snap. There was an error</div>
              <Button onClick={reset}>Reset</Button>
            </div>
          ) : (
            <div>{currentAction}</div>
          )
        }
        className="-m-4 lg:-m-7"
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
