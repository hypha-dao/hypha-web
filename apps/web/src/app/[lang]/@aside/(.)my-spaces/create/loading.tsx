'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useSpaceCreate } from '@web/hooks/use-space-create';

export default function Loading() {
  const { createSpace } = useSpaceCreate();
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
