'use client';

import { MemberDetail, SidePanel } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

export default function Loading() {
  const lang: Locale = 'en';
  const isLoading: boolean = true;
  return (
    <SidePanel>
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={isLoading}
        spaces={[]}
        lang={lang}
      />
    </SidePanel>
  );
}
