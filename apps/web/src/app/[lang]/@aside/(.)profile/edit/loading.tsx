import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useEditProfile } from '@web/hooks/use-edit-profile';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';

export default function Loading() {
  return (
    <SidePanel>
      <EditPersonSection
        avatar=""
        name=""
        surname=""
        id={null}
        nickname=""
        closeUrl=""
        description=""
        leadImageUrl=""
        isLoading={true}
        useEditProfile={useEditProfile}
        useUploadThingFileUploader={useUploadThingFileUploader}
        successfulEditCallback={() => {}}
      />
    </SidePanel>
  );
}
