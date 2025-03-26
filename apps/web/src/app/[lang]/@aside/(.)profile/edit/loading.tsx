'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';

export default function Loading() {
  return (
    <SidePanel>
      <EditPersonSection
        person={{}}
        closeUrl=""
        isLoading={true}
        onEdit={() => {
          console.log('onEdit');
          return Promise.resolve();
        }}
      />
    </SidePanel>
  );
}
