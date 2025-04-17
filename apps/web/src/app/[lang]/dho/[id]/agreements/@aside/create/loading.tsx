'use client';

import { CreateAgreementForm } from '@hypha-platform/epics';
import { SidePanel } from '../../../@aside/_components/side-panel';
import { useMe } from '@hypha-platform/core/client';

export default function Loading() {
  const { person } = useMe();
  return (
    <SidePanel>
      <CreateAgreementForm
        creator={{
          avatar: person?.avatarUrl || '',
          name: person?.name || '',
          surname: person?.surname || '',
        }}
        closeUrl={``}
        onCreate={() => {
          console.log('Publish proposal');
        }}
        isLoading={true}
      />
    </SidePanel>
  );
}
