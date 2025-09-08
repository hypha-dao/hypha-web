'use client';

import { ProposalDetail, SidePanel } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <ProposalDetail
        closeUrl={''}
        onAccept={() => console.log('accept')}
        onReject={() => console.log('reject')}
        onCheckProposalExpiration={() =>
          console.log('handleCheckProposalExpiration')
        }
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
    </SidePanel>
  );
}
