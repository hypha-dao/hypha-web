'use client';

import { SpaceForm, SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';

export default function AsideCreateSubspacePage() {
  return (
    <SidePanel>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        fullHeight={true}
        progress={0}
        isLoading={true}
        message={<></>}
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
