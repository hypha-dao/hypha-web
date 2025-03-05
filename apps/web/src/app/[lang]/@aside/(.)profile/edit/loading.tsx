import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';

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
      />
    </SidePanel>
  );
}
