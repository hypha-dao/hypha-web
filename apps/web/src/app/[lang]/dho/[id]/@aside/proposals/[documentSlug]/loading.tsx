'use client';

import { ProposalDetail, SidePanel } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <ProposalDetail
        closeUrl={''}
        onAccept={() => console.log('accept')}
        onReject={() => console.log('reject')}
        onSetActiveFilter={() => console.log('set active filter')}
        content={''}
        creator={{
          avatar: '',
          name: '',
          surname: '',
        }}
        title={''}
        status={''}
        isLoading={true}
      />
    </SidePanel>
  );
}
