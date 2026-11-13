'use client';

import { SpaceForm, ProposalOverlayShell } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useTranslations } from 'next-intl';

export default function AsideCreateSubspacePage() {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <ProposalOverlayShell>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
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
    </ProposalOverlayShell>
  );
}
