'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@web/hooks/use-me';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';
import { z } from 'zod';
import { schemaEditPersonWeb2 } from '@hypha-platform/core/client';

export default function EditProfilePage() {
  const router = useRouter();
  const { lang } = useParams();
  const { person, isLoading } = useMe();
  const { editProfile } = useEditProfile();
  const { handleDrop } = useUploadThingFileUploader({
    onUploadComplete: () => {
      console.log('upload complete');
    },
  });

  const handleEdit = async (values: z.infer<typeof schemaEditPersonWeb2>) => {
    if (!person?.id) return;
    try {
      const updatedValues = { ...values };

      if (updatedValues.avatarUrl instanceof File) {
        const uploadedUrl = await handleDrop([updatedValues.avatarUrl]);
        if (uploadedUrl) {
          updatedValues.avatarUrl = uploadedUrl;
        }
      }

      if (updatedValues.leadImageUrl instanceof File) {
        const uploadedUrl = await handleDrop([updatedValues.leadImageUrl]);
        if (uploadedUrl) {
          updatedValues.leadImageUrl = uploadedUrl;
        }
      }

      await editProfile({
        ...updatedValues,
        avatarUrl: String(updatedValues.avatarUrl || ''),
        leadImageUrl: String(updatedValues.leadImageUrl || ''),
      });
      router.push(`/${lang}/profile/`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <EditPersonSection
      person={person}
      closeUrl={`/${lang}/profile/`}
      isLoading={isLoading}
      onEdit={handleEdit}
    />
  );
}
