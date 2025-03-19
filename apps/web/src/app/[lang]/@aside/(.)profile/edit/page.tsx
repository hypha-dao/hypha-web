'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@web/hooks/use-me';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';

export default function EditProfilePage() {
  const router = useRouter();
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  return (
    <SidePanel>
      <EditPersonSection
        avatar={person?.avatarUrl ?? ''}
        name={person?.name ?? ''}
        surname={person?.surname ?? ''}
        id={person?.id ?? null}
        nickname={person?.nickname ?? ''}
        description={person?.description ?? ''}
        leadImageUrl={person?.leadImageUrl ?? ''}
        closeUrl={`/${lang}/person`}
        isLoading={isLoading}
        useEditProfile={useEditProfile}
        useUploadThingFileUploader={useUploadThingFileUploader}
        successfulEditCallback={() => {
          router.push(`/${lang}/profile/`);
        }}
      />
    </SidePanel>
  );
}
