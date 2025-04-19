import { MemberDetail, SidePanel } from '@hypha-platform/epics';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';

export default function Loading() {
  return (
    <SidePanel>
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={true}
        basePath=""
        spaces={[]}
        useDocuments={useSpaceDocuments}
      />
    </SidePanel>
  );
}
