'use client';

import { ProposalDetail, ProposalOverlayShell } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <ProposalOverlayShell>
      <ProposalDetail
        closeUrl={''}
        isCheckingExpiration={false}
        content={''}
        creator={{
          avatar: '',
          name: '',
          surname: '',
        }}
        title={''}
        status={''}
        isLoading={true}
        spaceSlug={''}
        label={''}
        documentSlug={''}
        dbTokens={[]}
      />
    </ProposalOverlayShell>
  );
}
