import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';

export default function Loading() {
  return (
    <SidePanel>
      <EditPersonSection
        person={{}}
        closeUrl=""
        isLoading={true}
        useUploadThingFileUploader={useUploadThingFileUploader}
      />
    </SidePanel>
  );
}
