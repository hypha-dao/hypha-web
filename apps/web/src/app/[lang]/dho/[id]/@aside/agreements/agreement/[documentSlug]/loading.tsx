'use client';

import { AgreementDetail, SidePanel } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <AgreementDetail
        closeUrl={''}
        onSetActiveFilter={() => console.log('set active filter')}
        content={''}
        creator={{
          avatarUrl: '',
          name: '',
          surname: '',
        }}
        title={''}
        commitment={0}
        status={''}
        isLoading={true}
        comments={[]}
      />
    </SidePanel>
  );
}
