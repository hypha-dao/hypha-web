'use client';

import { CreateSpaceForm, SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';

export default function AsideCreateSubspacePage() {
  return (
    <SidePanel>
      <LoadingBackdrop
        progress={0}
        isLoading={true}
        message={<></>}
        className="-m-9"
      >
        <CreateSpaceForm
          creator={{
            name: '',
            surname: '',
          }}
          closeUrl={''}
          onCreate={() => {
            console.log('onCreate');
          }}
          isLoading={true}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
