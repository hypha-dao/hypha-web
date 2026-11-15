'use client';

import { MemberDetail, ProposalOverlayShell } from '@hypha-platform/epics';
import { PERSON_OVERLAY_CLASS } from './person-overlay-class';

/** Shown while the person route loads: the empty detail, as in the main app. */
export default function Loading() {
  return (
    <ProposalOverlayShell className={PERSON_OVERLAY_CLASS}>
      <MemberDetail
        hideConnect
        closeUrl=""
        member={{}}
        isLoading
        spaces={[]}
        lang="en"
      />
    </ProposalOverlayShell>
  );
}
