import { MemberDetail } from '@hypha-platform/epics';
import { SidePanel } from '@web/app/[lang]/@aside/_components/side-panel';
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
