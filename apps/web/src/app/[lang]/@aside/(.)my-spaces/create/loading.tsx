'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useSpaceCreateWeb3 } from '@web/hooks/space/use-space-create.web3';

export default function Loading() {
  const { createSpace } = useSpaceCreateWeb3();
  return (
    <SidePanel>
      <CreateSpaceForm
        isLoading={true}
        creator={{
          avatar: '',
          name: '',
          surname: '',
        }}
        closeUrl={''}
        onCreate={createSpace}
      />
    </SidePanel>
  );
}
