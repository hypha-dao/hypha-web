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
import { useUpdateAccount, usePrivy } from '@privy-io/react-auth';

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
  const { user: privyUser, authenticated } = usePrivy();

  const hasEmailAccount = !!privyUser?.email?.address;
  const currentPrivyEmail = privyUser?.email?.address;

  const hasOAuthAccount = !!(privyUser?.google || privyUser?.apple);
  const cannotChangeEmail =
    authenticated && hasOAuthAccount && !hasEmailAccount;

  const schemaEditPersonForm = schemaEditPersonWeb2.extend(
    editPersonFiles.shape,
  );
  type EditPersonFormData = z.infer<typeof schemaEditPersonForm>;

  const pendingFormDataRef = React.useRef<EditPersonFormData | null>(null);

  const { updateEmail } = useUpdateAccount({
    onSuccess: async () => {
      if (pendingFormDataRef.current) {
        try {
          await editProfile(pendingFormDataRef.current);
          pendingFormDataRef.current = null;
          router.push('/profile');
        } catch (err) {
          console.log(err);
          pendingFormDataRef.current = null;
        }
      }
    },
    onError: (error, details) => {
      console.error('Error updating email in Privy:', error, details);
      if (
        error?.includes('does not have an email linked') ||
        error?.includes('email account')
      ) {
        if (pendingFormDataRef.current) {
          editProfile(pendingFormDataRef.current)
            .then(() => {
              router.push('/profile');
            })
            .catch((err) => {
              console.log(err);
            })
            .finally(() => {
              pendingFormDataRef.current = null;
            });
        }
      } else {
        pendingFormDataRef.current = null;
      }
    },
  });

  const onEdit = async (data: EditPersonFormData) => {
    try {
      const newEmail = data.email?.trim();
      const emailChanged =
        authenticated &&
        hasEmailAccount &&
        currentPrivyEmail &&
        newEmail &&
        newEmail !== currentPrivyEmail;

      if (emailChanged) {
        pendingFormDataRef.current = data;
        updateEmail();
      } else {
        await editProfile(data);
        router.push('/profile');
      }
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <SidePanel>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        fullHeight={true}
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
      >
        <EditPersonSection
          person={person}
          closeUrl={`/${lang}/profile/${personSlug}`}
          isLoading={isLoading || isEditing}
          onEdit={onEdit}
          onUpdate={revalidate}
          error={error}
          cannotChangeEmail={cannotChangeEmail}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
