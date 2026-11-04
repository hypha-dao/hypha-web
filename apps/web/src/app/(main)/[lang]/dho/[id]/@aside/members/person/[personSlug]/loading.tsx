'use client';

import { MemberDetail, ProposalOverlayShell } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

export default function Loading() {
  const lang: Locale = 'en';
  const isLoading: boolean = true;
  return (
    <ProposalOverlayShell className="md:max-w-[min(640px,calc(100vw_-_var(--sidebar-left-width,0px)_-_var(--sidebar-right-width,0px)_-_2rem))]">
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={isLoading}
        spaces={[]}
        lang={lang}
      />
    </ProposalOverlayShell>
  );
}
