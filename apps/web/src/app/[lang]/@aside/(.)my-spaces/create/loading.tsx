'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useCreateSpaceOrchestrator } from '@core/space';
import { useConfig } from 'wagmi';
import { useJwt } from '@web/hooks/use-jwt';

export default function Loading() {
  const config = useConfig();
  const { jwt: authToken } = useJwt();
  const { createSpace } = useCreateSpaceOrchestrator({ authToken, config });
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
