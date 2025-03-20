'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@web/hooks/use-me';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';
import { z } from 'zod';
import { schemaEditPersonWeb2 } from '@hypha-platform/core/client'

export default function EditProfilePage() {
  const router = useRouter();
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  const { editProfile } = useEditProfile();
  const handleEdit = async (values: z.infer<typeof schemaEditPersonWeb2>) => {
    if (!person?.id) return;
    await editProfile({
      ...values,
      id: person.id,
      leadImageUrl: values.leadImageUrl || '',
    });
  };

  return (
    <EditPersonSection
      person={person}
      closeUrl={`/${lang}/profile/`}
      isLoading={isLoading}
      useUploadThingFileUploader={useUploadThingFileUploader}
      onEdit={handleEdit}
      successfulEditCallback={() => {
        router.push(`/${lang}/profile/`);
      }}
    />
  );
}
