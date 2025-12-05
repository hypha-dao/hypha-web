'use client';

import { CreateAgreementForm, SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';

export default function AsideCreateAgreementPage() {
  return (
    <SidePanel>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        fullHeight={true}
        progress={0}
        isLoading={true}
        message={<></>}
      >
        <CreateAgreementForm
          spaceId={undefined}
          successfulUrl=""
          web3SpaceId={undefined}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
