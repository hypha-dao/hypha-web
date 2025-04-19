import { useMembers } from '@web/hooks/use-members';
import { SidePanel, SubspaceDetail } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <SubspaceDetail
        title={''}
        image={''}
        content={''}
        closeUrl={''}
        useMembers={useMembers}
        memberBasePath={''}
      />
    </SidePanel>
  );
}
