'use client';

import { SidePanel } from '@hypha-platform/epics';
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
        <div className="h-[200px]" />
      </LoadingBackdrop>
    </SidePanel>
  );
}
