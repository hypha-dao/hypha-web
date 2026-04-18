'use client';

import { ProposalOverlayShell } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useTranslations } from 'next-intl';

export default function AsideCreateAgreementPage() {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <ProposalOverlayShell>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
        fullHeight={true}
        fullHeightVariant="responsive-modal-shell"
        progress={0}
        isLoading={true}
        message={<></>}
      >
        <div className="h-[200px]" />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
