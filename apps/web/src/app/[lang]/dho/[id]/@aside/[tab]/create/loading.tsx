'use client';

import { CreateAgreementForm, SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';

export default function AsideCreateAgreementPage() {
  return (
    <SidePanel>
      <LoadingBackdrop
        progress={0}
        isLoading={true}
        message={<></>}
        className="-m-4 lg:-m-7"
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
