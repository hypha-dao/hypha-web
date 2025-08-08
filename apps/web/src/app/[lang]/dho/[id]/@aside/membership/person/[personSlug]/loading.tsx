'use client';

import { MemberDetail, SidePanel } from '@hypha-platform/epics';
import type {
  UseDocuments,
  UseDocumentsProps,
  UseDocumentsReturn,
} from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

export default function Loading() {
  const lang: Locale = 'en';
  const isLoading: boolean = true;
  const useSpaceDocuments: UseDocuments = (
    _: UseDocumentsProps,
  ): UseDocumentsReturn => ({ documents: [], isLoading });
  return (
    <SidePanel>
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={isLoading}
        basePath=""
        spaces={[]}
        lang={lang}
        useDocuments={useSpaceDocuments}
      />
    </SidePanel>
  );
}
