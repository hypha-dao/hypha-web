'use client';

import { SpaceForm, SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';

export default function AsideCreateSubspacePage() {
  return (
    <SidePanel>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        progress={0}
        isLoading={true}
        message={<></>}
        className="-m-4 lg:-m-7"
      >
        <SpaceForm
          creator={{
            name: '',
            surname: '',
          }}
          closeUrl={''}
          onSubmit={() => {
            console.log('onCreate');
          }}
          isLoading={true}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
