'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';

import React from 'react';
import { useCreateSpace } from '@web/hooks/use-create-space';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const { createSpace, hash, spaceId } = useCreateSpace();

  return (
    <SidePanel>
      <CreateSpaceForm
        isLoading={false}
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={`/${lang}/my-spaces`}
        onCreate={createSpace}
      />
      {hash && <div>Transaction Hash: {hash}</div>}
      {spaceId && <div>Space ID: {spaceId}</div>}
    </SidePanel>
  );
}
