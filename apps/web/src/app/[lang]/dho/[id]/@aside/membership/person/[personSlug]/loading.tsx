import {
  MemberDetail,
  SidePanel,
  UseDocuments,
  UseDocumentsProps,
  UseDocumentsReturn,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

export default async function Loading() {
  const lang: Locale = 'en';
  const useSpaceDocuments: UseDocuments = (
    _: UseDocumentsProps,
  ): UseDocumentsReturn => ({ documents: [], isLoading: false });
  return (
    <SidePanel>
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={true}
        basePath=""
        spaces={[]}
        lang={lang}
        useDocuments={useSpaceDocuments}
      />
    </SidePanel>
  );
}
