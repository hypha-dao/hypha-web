'use client';

import { SpaceForm, ProposalOverlayShell } from '@hypha-platform/epics';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

export default function AsideCreateSubspacePage() {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const pathname = usePathname();
  const closeUrl = (() => {
    const segment = '/space/create';
    if (pathname.endsWith(segment)) {
      return pathname.slice(0, -segment.length) || '/';
    }
    if (pathname.endsWith(`${segment}/`)) {
      return pathname.slice(0, -(segment.length + 1)) || '/';
    }
    if (pathname.includes(`${segment}/`)) {
      return pathname.replace(`${segment}/`, '/');
    }
    return pathname.replace(segment, '') || '/';
  })();

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
          closeUrl={closeUrl}
          onSubmit={() => {
            console.log('onCreate');
          }}
          isLoading={true}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
